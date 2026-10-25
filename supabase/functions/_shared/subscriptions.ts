import type { AccessInterval } from "./billing.ts";
import { dollarsFromCents, PAYPAL_ENV, paypalFetch } from "./paypal.ts";
import { stripeRequest } from "./stripe.ts";
import { serviceClient } from "./supabase.ts";

export const GRACE_DAYS = 3;

export const WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.RE-ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
  "CUSTOMER.DISPUTE.CREATED",
  "CUSTOMER.DISPUTE.RESOLVED",
];

// Bump when WEBHOOK_EVENTS changes so already-registered webhooks get the new event list.
const WEBHOOK_EVENTS_VERSION = "v3";

type Admin = ReturnType<typeof serviceClient>;

// Sandbox and live PayPal objects have different IDs, so sandbox refs get their own keys.
export function refKey(key: string) {
  return PAYPAL_ENV === "live" ? key : `sandbox:${key}`;
}

async function readRef(admin: Admin, key: string) {
  const { data } = await admin.from("paypal_billing_refs").select("paypal_id").eq("key", refKey(key)).maybeSingle();
  return (data as { paypal_id: string } | null)?.paypal_id ?? null;
}

async function saveRef(admin: Admin, key: string, paypalId: string) {
  await admin
    .from("paypal_billing_refs")
    .upsert({ key: refKey(key), paypal_id: paypalId }, { onConflict: "key", ignoreDuplicates: true });
  return (await readRef(admin, key)) ?? paypalId;
}

export async function ensureProduct(admin: Admin) {
  const existing = await readRef(admin, "product");
  if (existing) return existing;
  const res = await paypalFetch("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: "Safety Prep List",
      description: "Practical preparedness checklists for households.",
      type: "SERVICE",
    }),
  });
  if (!res.ok) {
    console.error("PayPal product create failed", res.status, res.body);
    throw new Error("Could not set up PayPal billing");
  }
  return saveRef(admin, "product", (res.body as { id: string }).id);
}

export type PlanSpec = {
  interval: AccessInterval;
  quantity: number;
  regularCents: number;
  trialCents: number | null;
  trialCycles: number;
  setupCents: number;
};

function planKey(spec: PlanSpec) {
  const trial = spec.trialCents == null ? "none" : `${spec.trialCents}x${spec.trialCycles}`;
  return `plan:${spec.interval}:q${spec.quantity}:r${spec.regularCents}:t${trial}:s${spec.setupCents}`;
}

function cycle(interval: AccessInterval, tenure: "TRIAL" | "REGULAR", sequence: number, totalCycles: number, cents: number) {
  return {
    frequency: { interval_unit: interval === "annual" ? "YEAR" : "MONTH", interval_count: 1 },
    tenure_type: tenure,
    sequence,
    total_cycles: totalCycles,
    // PayPal models a free trial cycle by omitting pricing_scheme.
    ...(cents > 0 ? { pricing_scheme: { fixed_price: { value: dollarsFromCents(cents), currency_code: "USD" } } } : {}),
  };
}

export async function ensurePlan(admin: Admin, spec: PlanSpec) {
  const key = planKey(spec);
  const existing = await readRef(admin, key);
  if (existing) return existing;
  const productId = await ensureProduct(admin);
  const hasTrial = spec.trialCents != null && spec.trialCycles > 0;
  const people = spec.quantity > 1 ? `Family Plan, ${spec.quantity} checklists` : "Individual Plan";
  const res = await paypalFetch("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      name: `Safety Prep List ${people}, ${spec.interval === "annual" ? "Annual" : "Monthly"}`.slice(0, 127),
      status: "ACTIVE",
      billing_cycles: hasTrial
        ? [
            cycle(spec.interval, "TRIAL", 1, spec.trialCycles, spec.trialCents!),
            cycle(spec.interval, "REGULAR", 2, 0, spec.regularCents),
          ]
        : [cycle(spec.interval, "REGULAR", 1, 0, spec.regularCents)],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 1,
        ...(spec.setupCents > 0
          ? {
              setup_fee: { value: dollarsFromCents(spec.setupCents), currency_code: "USD" },
              setup_fee_failure_action: "CANCEL",
            }
          : {}),
      },
    }),
  });
  if (!res.ok) {
    console.error("PayPal plan create failed", res.status, res.body);
    throw new Error("Could not set up PayPal billing");
  }
  return saveRef(admin, key, (res.body as { id: string }).id);
}

export function webhookUrl() {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/paypal-webhook`;
}

async function syncWebhookEvents(admin: Admin, webhookId: string) {
  const versionKey = `webhook-events:${WEBHOOK_EVENTS_VERSION}`;
  if (await readRef(admin, versionKey)) return;
  const res = await paypalFetch(`/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`, {
    method: "PATCH",
    body: JSON.stringify([
      { op: "replace", path: "/event_types", value: WEBHOOK_EVENTS.map((name) => ({ name })) },
    ]),
  });
  if (!res.ok) {
    console.error("PayPal webhook event update failed", res.status, res.body);
    return;
  }
  await saveRef(admin, versionKey, webhookId);
}

export async function ensureWebhook(admin: Admin) {
  const existing = await readRef(admin, "webhook");
  if (existing) {
    await syncWebhookEvents(admin, existing);
    return existing;
  }
  const url = webhookUrl();
  const res = await paypalFetch("/v1/notifications/webhooks", {
    method: "POST",
    body: JSON.stringify({ url, event_types: WEBHOOK_EVENTS.map((name) => ({ name })) }),
  });
  if (res.ok) return saveRef(admin, "webhook", (res.body as { id: string }).id);
  const list = await paypalFetch("/v1/notifications/webhooks");
  const hooks = ((list.body as { webhooks?: Array<{ id: string; url: string }> })?.webhooks) || [];
  const match = hooks.find((hook) => hook.url === url);
  if (!match) {
    console.error("PayPal webhook create failed", res.status, res.body);
    throw new Error("Could not set up PayPal webhook");
  }
  return saveRef(admin, "webhook", match.id);
}

type PaypalSubscription = {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  subscriber?: { email_address?: string };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string; amount?: { value?: string } };
  };
};

export async function fetchSubscription(paypalSubscriptionId: string | null | undefined) {
  if (!paypalSubscriptionId) return null;
  const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(paypalSubscriptionId)}`);
  if (!res.ok) {
    console.error("PayPal subscription fetch failed", res.status, res.body);
    return null;
  }
  return res.body as PaypalSubscription;
}

function addInterval(from: Date, interval: AccessInterval) {
  const next = new Date(from);
  if (interval === "annual") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function localStatus(paypalStatus: string) {
  switch (paypalStatus) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "suspended";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    default:
      return "approval_pending";
  }
}

function stripeLocalStatus(status: string, cancelAtPeriodEnd?: boolean) {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "suspended";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    case "incomplete":
      return cancelAtPeriodEnd ? "cancelled" : "approval_pending";
    default:
      return "approval_pending";
  }
}

function unixToDate(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!n) return null;
  return new Date(n * 1000);
}

export async function fetchStripeSubscription(stripeSubscriptionId: string | null | undefined) {
  if (!stripeSubscriptionId) return null;
  const res = await stripeRequest<Record<string, unknown>>("GET", `/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`);
  if (!res.ok) {
    console.error("Stripe subscription fetch failed", res.status, res.body);
    return null;
  }
  return res.body;
}

export type SubscriptionRow = {
  id: string;
  provider?: "paypal" | "stripe";
  paypal_subscription_id: string | null;
  paypal_plan_id: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_price_id?: string | null;
  user_id: string | null;
  purchase_id: string | null;
  purpose: "new" | "add_member" | "renew";
  access_interval: AccessInterval;
  quantity: number;
  regular_cents: number;
  first_payment_cents: number;
  vault_cents: number;
  discount_code: string | null;
  discount_cents: number;
  discount_payments: number | null;
  status: string;
  paid_through: string | null;
  access_ends_at: string | null;
  refunded_at?: string | null;
};

function applyAccessDates(row: SubscriptionRow, status: string, paidThrough: Date | null) {
  let endsAt: Date | null = null;
  let through = paidThrough;
  if (through && status !== "approval_pending") {
    endsAt = new Date(through);
    if (status === "active" || status === "suspended") endsAt.setUTCDate(endsAt.getUTCDate() + GRACE_DAYS);
  }
  if (row.refunded_at) {
    through = new Date(row.refunded_at);
    endsAt = new Date(row.refunded_at);
  }
  return { through, endsAt, status };
}

async function saveSubscriptionAccess(
  admin: Admin,
  row: SubscriptionRow,
  status: string,
  paidThrough: Date | null,
) {
  const dates = applyAccessDates(row, status, paidThrough);
  const patch = {
    status: dates.status,
    paid_through: dates.through?.toISOString() ?? null,
    access_ends_at: dates.endsAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
    ...(dates.status === "cancelled" && !row.status.startsWith("cancel")
      ? { cancelled_at: new Date().toISOString() }
      : {}),
  };
  const { data, error } = await admin
    .from("subscriptions")
    .update(patch)
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw error;
  await admin.rpc("sync_subscription_access", { p_subscription_id: row.id });
  return data as SubscriptionRow;
}

export async function syncStripeSubscription(
  admin: Admin,
  row: SubscriptionRow,
  remote?: Record<string, unknown> | null,
) {
  const sub = remote ?? (await fetchStripeSubscription(row.stripe_subscription_id || null));
  if (!sub) return row;
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
  const status = stripeLocalStatus(String(sub.status || ""), cancelAtPeriodEnd);
  const items = (sub.items as { data?: Array<{ current_period_end?: number }> } | undefined)?.data;
  const periodEnd =
    unixToDate(sub.current_period_end) ||
    unixToDate(items?.[0]?.current_period_end) ||
    unixToDate(sub.cancel_at);
  let paidThrough = row.paid_through ? new Date(row.paid_through) : null;
  if (periodEnd && (!paidThrough || periodEnd > paidThrough)) paidThrough = periodEnd;
  const saved = await saveSubscriptionAccess(admin, row, status, paidThrough);
  if (typeof sub.customer === "string") {
    await admin.from("subscriptions").update({ stripe_customer_id: sub.customer }).eq("id", row.id);
    if (row.user_id) await admin.from("profiles").update({ stripe_customer_id: sub.customer }).eq("id", row.user_id);
  }
  return saved;
}

// Pulls the subscription from PayPal or Stripe and recomputes paid-through and access end.
export async function syncSubscription(admin: Admin, row: SubscriptionRow, remote?: PaypalSubscription | null) {
  if (row.provider === "stripe" || row.stripe_subscription_id) {
    return syncStripeSubscription(admin, row);
  }
  const sub = remote ?? (await fetchSubscription(row.paypal_subscription_id));
  if (!sub) return row;
  const status = localStatus(sub.status);
  const interval = row.access_interval;
  const lastPayment = sub.billing_info?.last_payment?.time;
  const nextBilling = sub.billing_info?.next_billing_time;

  let paidThrough = row.paid_through ? new Date(row.paid_through) : null;
  if (status === "active" && nextBilling) {
    paidThrough = new Date(nextBilling);
  } else if (lastPayment) {
    const fromPayment = addInterval(new Date(lastPayment), interval);
    if (!paidThrough || fromPayment > paidThrough) paidThrough = fromPayment;
  }
  return saveSubscriptionAccess(admin, row, status, paidThrough);
}
