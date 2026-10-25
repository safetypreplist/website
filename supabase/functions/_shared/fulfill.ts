import { renewalLine } from "./billing.ts";
import { incrementDiscountRedemption } from "./discounts.ts";
import { generateProductCode } from "./productCode.ts";
import { stripeRequest } from "./stripe.ts";
import { syncStripeSubscription, type SubscriptionRow } from "./subscriptions.ts";
import { sendPurchaseEmail, serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

export type ActivationResult =
  | { ok: true; alreadyProcessed: boolean; productCode: string; productType: string; purchaseId: string; linkedToUser: boolean }
  | { ok: false; status: number; error: string };

type StripeSession = {
  id: string;
  mode?: string;
  payment_status?: string;
  status?: string;
  customer?: string | { id?: string; email?: string } | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  subscription?: string | Record<string, unknown> | null;
  payment_intent?: string | { id?: string } | null;
  invoice?: string | { id?: string } | null;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
};

function sessionPaid(session: StripeSession) {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

function customerId(session: StripeSession) {
  const customer = session.customer;
  if (typeof customer === "string") return customer;
  return customer?.id || null;
}

function customerEmail(session: StripeSession) {
  if (typeof session.customer === "object" && session.customer?.email) return session.customer.email;
  return session.customer_details?.email || session.customer_email || null;
}

function objectId(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return (value as { id?: string }).id || null;
}

async function uniqueProductCode(admin: Admin) {
  let productCode = generateProductCode();
  for (let i = 0; i < 5; i++) {
    const clash = await admin.from("purchases").select("id").eq("product_code", productCode).maybeSingle();
    if (!clash.data) break;
    productCode = generateProductCode();
  }
  return productCode;
}

function processed(prior: { id: string; product_code: string; product_type: string; user_id: string | null }): ActivationResult {
  return {
    ok: true,
    alreadyProcessed: true,
    productCode: prior.product_code,
    productType: prior.product_type,
    purchaseId: prior.id,
    linkedToUser: Boolean(prior.user_id),
  };
}

export async function retrieveCheckoutSession(sessionId: string) {
  const res = await stripeRequest<StripeSession>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    expand: ["subscription", "customer", "payment_intent", "invoice"],
  });
  if (!res.ok) return null;
  return res.body;
}

async function recordSubscriptionPayment(
  admin: Admin,
  row: SubscriptionRow,
  args: { invoiceId: string | null; amountCents: number; paidAt: string; paymentIntent?: string | null; chargeId?: string | null; status?: string; failureReason?: string | null },
) {
  const reference = args.invoiceId || args.paymentIntent || (args.status === "failed" ? `failed:${crypto.randomUUID()}` : null);
  if (!reference) return;
  const payload = {
    subscription_id: row.id,
    paypal_sale_id: `stripe:${reference}`,
    stripe_invoice_id: args.invoiceId,
    stripe_payment_intent_id: args.paymentIntent || null,
    stripe_charge_id: args.chargeId || null,
    amount_cents: args.amountCents,
    paid_at: args.paidAt,
    status: args.status || "completed",
    failure_reason: args.failureReason || null,
  };
  await admin.from("subscription_payments").upsert(payload, { onConflict: "paypal_sale_id", ignoreDuplicates: true });
}

export async function fulfillCheckoutSession(admin: Admin, session: StripeSession): Promise<ActivationResult> {
  if (!sessionPaid(session) || session.status === "expired") {
    return { ok: false, status: 402, error: "Stripe has not confirmed this payment yet. Refresh this page in a minute." };
  }

  const existing = await admin
    .from("purchases")
    .select("id, product_code, product_type, user_id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (existing.data) return processed(existing.data as { id: string; product_code: string; product_type: string; user_id: string | null });

  const localId = session.metadata?.subscription_id;
  let row: SubscriptionRow | null = null;
  if (localId) {
    const found = await admin.from("subscriptions").select("*").eq("id", localId).maybeSingle();
    row = (found.data as SubscriptionRow | null) ?? null;
  }
  if (!row) {
    const found = await admin.from("subscriptions").select("*").eq("stripe_checkout_session_id", session.id).maybeSingle();
    row = (found.data as SubscriptionRow | null) ?? null;
  }

  const stripeSubId = objectId(session.subscription);
  const intentId = objectId(session.payment_intent);
  const invoiceId = objectId(session.invoice);
  const email = customerEmail(session);
  const stripeCust = customerId(session);
  const amountCents = session.amount_total ?? row?.first_payment_cents ?? 0;

  if (session.mode === "payment") {
    return fulfillOneTime(admin, session, { email, stripeCust, intentId, amountCents });
  }

  if (!row) {
    return { ok: false, status: 404, error: "Unknown checkout session" };
  }

  if (row.purchase_id) {
    const prior = await admin.from("purchases").select("id, product_code, product_type, user_id").eq("id", row.purchase_id).maybeSingle();
    if (prior.data) return processed(prior.data as { id: string; product_code: string; product_type: string; user_id: string | null });
  }

  const productCode = await uniqueProductCode(admin);
  const insert = await admin
    .from("purchases")
    .insert({
      user_id: row.user_id,
      provider: "stripe",
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: stripeSubId,
      stripe_payment_intent_id: intentId,
      stripe_invoice_id: invoiceId,
      product_code: productCode,
      product_type: "core",
      amount_cents: amountCents,
      currency: "USD",
      payment_status: "completed",
      payer_email: email,
      raw_payload: session,
      completed_at: new Date().toISOString(),
      quantity: row.quantity,
      includes_household: row.vault_cents > 0,
      access_interval: row.access_interval,
      access_cents: row.regular_cents,
      vault_cents: row.vault_cents,
      discount_code: row.discount_code,
      discount_cents: row.discount_cents,
      discount_payments: row.discount_payments,
    })
    .select("*")
    .single();

  if (insert.error) {
    const raced = await admin
      .from("purchases")
      .select("id, product_code, product_type, user_id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (raced.data) return processed(raced.data as { id: string; product_code: string; product_type: string; user_id: string | null });
    console.error(insert.error);
    return { ok: false, status: 500, error: "Could not record purchase" };
  }

  await admin
    .from("subscriptions")
    .update({
      purchase_id: insert.data.id,
      stripe_subscription_id: stripeSubId,
      stripe_customer_id: stripeCust,
      status: "active",
    })
    .eq("id", row.id);

  if (row.user_id && stripeCust) {
    await admin.from("profiles").update({ stripe_customer_id: stripeCust }).eq("id", row.user_id);
  }

  const current = { ...row, purchase_id: insert.data.id, stripe_subscription_id: stripeSubId, stripe_customer_id: stripeCust };
  await syncStripeSubscription(admin, current);
  await recordSubscriptionPayment(admin, current, {
    invoiceId,
    amountCents,
    paidAt: new Date().toISOString(),
    paymentIntent: intentId,
  });

  if (row.user_id) {
    const rpc = row.purpose === "renew" ? "link_purchase_subscription" : "apply_purchase_entitlements";
    const applied = await admin.rpc(rpc, { p_purchase_id: insert.data.id });
    if (applied.error) console.error(applied.error);
  }

  if (row.discount_code) await incrementDiscountRedemption(row.discount_code);

  if (email) {
    const billingLabel = row.access_interval === "annual" ? "Annual" : "Monthly";
    const vault = row.vault_cents > 0 ? " + Survival Vault" : "";
    await sendPurchaseEmail({
      to: email,
      planName: row.purpose === "add_member"
        ? `${row.quantity} additional checklist${row.quantity === 1 ? "" : "s"}, ${billingLabel}${vault}`
        : row.quantity > 1
          ? `Family Plan (${row.quantity} personal checklists), ${billingLabel}${vault}`
          : `Individual Plan, ${billingLabel}${vault}`,
      productCode,
      deviceAllowance: renewalLine(
        row.access_interval,
        row.regular_cents,
        row.discount_cents,
        row.discount_payments || 1,
        row.vault_cents > 0,
      ),
    });
  }

  return {
    ok: true,
    alreadyProcessed: false,
    productCode,
    productType: "core",
    purchaseId: insert.data.id,
    linkedToUser: Boolean(row.user_id),
  };
}

async function fulfillOneTime(
  admin: Admin,
  session: StripeSession,
  args: { email: string | null; stripeCust: string | null; intentId: string | null; amountCents: number },
): Promise<ActivationResult> {
  const userId = session.metadata?.user_id || null;
  const productCode = await uniqueProductCode(admin);
  const insert = await admin
    .from("purchases")
    .insert({
      user_id: userId,
      provider: "stripe",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: args.intentId,
      product_code: productCode,
      product_type: "upgrade_full",
      amount_cents: args.amountCents,
      currency: "USD",
      payment_status: "completed",
      payer_email: args.email,
      raw_payload: session,
      completed_at: new Date().toISOString(),
      quantity: 1,
      includes_household: true,
      vault_cents: args.amountCents,
    })
    .select("*")
    .single();
  if (insert.error) {
    const raced = await admin
      .from("purchases")
      .select("id, product_code, product_type, user_id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (raced.data) return processed(raced.data as { id: string; product_code: string; product_type: string; user_id: string | null });
    console.error(insert.error);
    return { ok: false, status: 500, error: "Could not record purchase" };
  }
  if (userId) {
    const applied = await admin.rpc("apply_purchase_entitlements", { p_purchase_id: insert.data.id });
    if (applied.error) console.error(applied.error);
    if (args.stripeCust) await admin.from("profiles").update({ stripe_customer_id: args.stripeCust }).eq("id", userId);
  }
  if (args.email) {
    await sendPurchaseEmail({
      to: args.email,
      planName: "Survival Vault",
      productCode,
      deviceAllowance: "Survival Vault does not renew.",
    });
  }
  return {
    ok: true,
    alreadyProcessed: false,
    productCode,
    productType: "upgrade_full",
    purchaseId: insert.data.id,
    linkedToUser: Boolean(userId),
  };
}

export async function recordInvoicePayment(admin: Admin, invoice: Record<string, unknown>) {
  const stripeSubId = objectId(invoice.subscription);
  if (!stripeSubId) return;
  const found = await admin.from("subscriptions").select("*").eq("stripe_subscription_id", stripeSubId).maybeSingle();
  const row = found.data as SubscriptionRow | null;
  if (!row) return;
  const paid = invoice.status === "paid";
  const amount = Number(invoice.amount_paid ?? invoice.amount_due ?? row.regular_cents) || row.regular_cents;
  await recordSubscriptionPayment(admin, row, {
    invoiceId: objectId(invoice) || String(invoice.id || ""),
    amountCents: amount,
    paidAt: new Date(
      (Number((invoice.status_transitions as { paid_at?: number } | undefined)?.paid_at || invoice.created) || Date.now() / 1000) * 1000,
    ).toISOString(),
    paymentIntent: objectId(invoice.payment_intent),
    chargeId: objectId(invoice.charge),
    status: paid ? "completed" : "failed",
    failureReason: paid ? null : String(invoice.last_finalization_error || invoice.billing_reason || "invoice.payment_failed"),
  });
  await syncStripeSubscription(admin, row);
}

export async function endAccessForStripeInvoice(admin: Admin, invoiceId: string | null, subscriptionId: string | null) {
  let row: SubscriptionRow | null = null;
  if (subscriptionId) {
    const found = await admin.from("subscriptions").select("*").eq("stripe_subscription_id", subscriptionId).maybeSingle();
    row = (found.data as SubscriptionRow | null) ?? null;
  }
  if (!row && invoiceId) {
    const payment = await admin.from("subscription_payments").select("subscription_id").eq("stripe_invoice_id", invoiceId).maybeSingle();
    const id = (payment.data as { subscription_id?: string } | null)?.subscription_id;
    if (id) {
      const found = await admin.from("subscriptions").select("*").eq("id", id).maybeSingle();
      row = (found.data as SubscriptionRow | null) ?? null;
    }
  }
  if (!row) return;
  const { endSubscriptionAccess } = await import("./refundAccess.ts");
  await endSubscriptionAccess(admin, row);
}
