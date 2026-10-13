import { json, preflight } from "../_shared/http.ts";
import { paypalFetch } from "../_shared/paypal.ts";
import { syncSubscription, type SubscriptionRow } from "../_shared/subscriptions.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

const REFUND_WINDOW_DAYS = 3;

type Admin = ReturnType<typeof serviceClient>;

type RefundRequest = {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  message: string | null;
  status: "pending" | "refunded" | "denied";
  refunded_cents: number | null;
  paypal_refund_ids: string[];
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

type PurchaseRow = {
  id: string;
  product_type: string;
  amount_cents: number;
  payment_status: string;
  paypal_capture_id: string | null;
  paypal_subscription_id: string | null;
  completed_at: string | null;
  created_at: string;
};

type SalePaymentRow = {
  id: string;
  subscription_id: string;
  paypal_sale_id: string;
  amount_cents: number;
  paid_at: string;
  status: string;
};

type Payment = {
  id: string;
  kind: "sale" | "capture";
  paypalId: string;
  amountCents: number;
  paidAt: string;
  status: string;
  label: string;
  isVault: boolean;
  subscriptionId: string | null;
  purchaseId: string | null;
};

type Account = {
  userId: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  accessStatus: string | null;
  firstPaidAt: string | null;
  refundableUntil: string | null;
  firstPrint: { at: string; list: string | null; source: string } | null;
  printCount: number;
  payments: Payment[];
  subscriptions: SubscriptionRow[];
};

function intervalLabel(interval: string | null | undefined) {
  return interval === "annual" ? "Annual plan" : interval === "monthly" ? "Monthly plan" : "Plan";
}

function paypalError(body: unknown) {
  const b = body as { message?: string; details?: Array<{ description?: string; issue?: string }> } | null;
  return b?.details?.[0]?.description || b?.details?.[0]?.issue || b?.message || "PayPal rejected the refund.";
}

// Subscription charges arrive by webhook; if none have arrived yet, pull them from PayPal directly.
async function backfillSales(admin: Admin, sub: SubscriptionRow & { created_at?: string }) {
  const start = new Date(new Date(sub.created_at || Date.now()).getTime() - 86_400_000).toISOString();
  const end = new Date().toISOString();
  const res = await paypalFetch(
    `/v1/billing/subscriptions/${encodeURIComponent(sub.paypal_subscription_id)}/transactions?start_time=${start}&end_time=${end}`,
  );
  if (!res.ok) return;
  const list = ((res.body as { transactions?: Array<Record<string, unknown>> })?.transactions || []) as Array<{
    id?: string;
    status?: string;
    time?: string;
    amount_with_breakdown?: { gross_amount?: { value?: string } };
  }>;
  const rows = list
    .filter((t) => t.id && (t.status === "COMPLETED" || t.status === "REFUNDED" || t.status === "PARTIALLY_REFUNDED"))
    .map((t) => ({
      subscription_id: sub.id,
      paypal_sale_id: t.id!,
      amount_cents: Math.round(parseFloat(t.amount_with_breakdown?.gross_amount?.value || "0") * 100),
      paid_at: t.time || new Date().toISOString(),
      status: t.status === "COMPLETED" ? "completed" : "refunded",
    }));
  if (rows.length) {
    await admin.from("subscription_payments").upsert(rows, { onConflict: "paypal_sale_id", ignoreDuplicates: true });
  }
}

async function loadAccount(admin: Admin, userId: string, backfill: boolean): Promise<Account> {
  const [profileRes, purchasesRes, subsRes, printsRes] = await Promise.all([
    admin.from("profiles").select("email,full_name,plan,access_status").eq("id", userId).maybeSingle(),
    admin
      .from("purchases")
      .select("id,product_type,amount_cents,payment_status,paypal_capture_id,paypal_subscription_id,completed_at,created_at")
      .eq("user_id", userId),
    admin.from("subscriptions").select("*").eq("user_id", userId).neq("status", "approval_pending"),
    admin.from("print_events").select("created_at,list_slug,source").eq("user_id", userId).order("created_at"),
  ]);
  const profile = profileRes.data as { email: string | null; full_name: string | null; plan: string; access_status: string } | null;
  const purchases = (purchasesRes.data || []) as PurchaseRow[];
  const subs = (subsRes.data || []) as Array<SubscriptionRow & { created_at?: string }>;
  const prints = (printsRes.data || []) as Array<{ created_at: string; list_slug: string | null; source: string }>;

  const subIds = subs.map((s) => s.id);
  const loadSales = async () =>
    subIds.length
      ? (((await admin.from("subscription_payments").select("*").in("subscription_id", subIds)).data || []) as SalePaymentRow[])
      : [];
  let sales = await loadSales();
  if (backfill) {
    const missing = subs.filter((s) => !sales.some((p) => p.subscription_id === s.id && p.status !== "failed"));
    if (missing.length) {
      await Promise.all(missing.map((s) => backfillSales(admin, s)));
      sales = await loadSales();
    }
  }

  const payments: Payment[] = [];
  for (const sale of sales) {
    if (sale.status === "failed") continue;
    const sub = subs.find((s) => s.id === sale.subscription_id);
    const firstSale = sales
      .filter((p) => p.subscription_id === sale.subscription_id && p.status !== "failed")
      .sort((a, b) => a.paid_at.localeCompare(b.paid_at))[0];
    const isVault = Boolean(sub && sub.vault_cents > 0 && sale.amount_cents === sub.vault_cents && firstSale?.id === sale.id);
    payments.push({
      id: `sp:${sale.id}`,
      kind: "sale",
      paypalId: sale.paypal_sale_id,
      amountCents: sale.amount_cents,
      paidAt: sale.paid_at,
      status: sale.status,
      label: isVault ? "Survival Vault" : intervalLabel(sub?.access_interval),
      isVault,
      subscriptionId: sale.subscription_id,
      purchaseId: sub?.purchase_id ?? null,
    });
  }
  for (const p of purchases) {
    if (p.paypal_subscription_id || !p.paypal_capture_id) continue;
    if (p.payment_status !== "completed" && p.payment_status !== "refunded") continue;
    const isVault = p.product_type === "upgrade_full";
    payments.push({
      id: `pu:${p.id}`,
      kind: "capture",
      paypalId: p.paypal_capture_id,
      amountCents: p.amount_cents,
      paidAt: p.completed_at || p.created_at,
      status: p.payment_status,
      label: isVault ? "Survival Vault" : p.product_type === "extra_device" ? "Extra device" : "One-time purchase",
      isVault,
      subscriptionId: null,
      purchaseId: p.id,
    });
  }
  payments.sort((a, b) => a.paidAt.localeCompare(b.paidAt));

  const paidDates = purchases
    .filter((p) => p.payment_status === "completed" || p.payment_status === "refunded")
    .map((p) => p.completed_at || p.created_at)
    .concat(payments.map((p) => p.paidAt))
    .sort();
  const firstPaidAt = paidDates[0] ?? null;
  const refundableUntil = firstPaidAt
    ? new Date(new Date(firstPaidAt).getTime() + REFUND_WINDOW_DAYS * 86_400_000).toISOString()
    : null;

  return {
    userId,
    email: profile?.email ?? null,
    name: profile?.full_name ?? null,
    plan: profile?.plan ?? null,
    accessStatus: profile?.access_status ?? null,
    firstPaidAt,
    refundableUntil,
    firstPrint: prints[0] ? { at: prints[0].created_at, list: prints[0].list_slug, source: prints[0].source } : null,
    printCount: prints.length,
    payments,
    subscriptions: subs,
  };
}

// Subscription charges are v1 "sales"; one-time checkouts are v2 "captures". Each falls back to the other API if PayPal can't find it.
async function refundPayment(payment: Payment) {
  const id = encodeURIComponent(payment.paypalId);
  const paths = [`/v1/payments/sale/${id}/refund`, `/v2/payments/captures/${id}/refund`];
  if (payment.kind === "capture") paths.reverse();
  const request = (path: string) =>
    paypalFetch(path, {
      method: "POST",
      headers: { "PayPal-Request-Id": `spl-refund-${payment.id}` },
      body: JSON.stringify({}),
    });
  let res = await request(paths[0]);
  if (!res.ok && res.status === 404) {
    const fallback = await request(paths[1]);
    if (fallback.ok || fallback.status !== 404) res = fallback;
  }
  if (!res.ok) {
    console.error("PayPal refund failed", payment.id, res.status, res.body);
    return { ok: false as const, error: paypalError(res.body) };
  }
  return { ok: true as const, refundId: String((res.body as { id?: string })?.id || "") };
}

// Cancels the subscription in PayPal and ends access now, so later PayPal syncs can't restore it.
async function endSubscriptionAccess(admin: Admin, sub: SubscriptionRow) {
  if (sub.status === "active" || sub.status === "suspended") {
    const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(sub.paypal_subscription_id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Refunded" }),
    });
    if (!res.ok && res.status !== 422) console.error("PayPal cancel after refund failed", res.status, res.body);
  }
  const now = new Date().toISOString();
  const { data } = await admin
    .from("subscriptions")
    .update({ refunded_at: now, paid_through: now, access_ends_at: now, updated_at: now })
    .eq("id", sub.id)
    .select("*")
    .single();
  await syncSubscription(admin, (data as SubscriptionRow) ?? { ...sub, refunded_at: now });
  if (sub.purchase_id) await admin.rpc("revoke_refunded_purchase", { p_purchase_id: sub.purchase_id, p_mark_refunded: true });
}

async function applyAccessChanges(admin: Admin, account: Account, refunded: Payment[]) {
  const subIds = new Set(refunded.filter((p) => p.subscriptionId && !p.isVault).map((p) => p.subscriptionId!));
  for (const sub of account.subscriptions) {
    if (subIds.has(sub.id)) await endSubscriptionAccess(admin, sub);
  }
  for (const p of refunded) {
    if (p.kind === "capture" && p.purchaseId) {
      await admin.rpc("revoke_refunded_purchase", { p_purchase_id: p.purchaseId, p_mark_refunded: true });
    } else if (p.isVault && p.purchaseId && !subIds.has(p.subscriptionId!)) {
      await admin.rpc("revoke_refunded_purchase", { p_purchase_id: p.purchaseId, p_mark_refunded: false });
    }
  }
}

async function matchUser(admin: Admin, request: RefundRequest) {
  if (request.user_id) return request.user_id;
  const { data } = await admin.from("profiles").select("id").eq("email", request.email.toLowerCase()).maybeSingle();
  const id = (data as { id: string } | null)?.id ?? null;
  if (id) await admin.from("refund_requests").update({ user_id: id }).eq("id", request.id);
  return id;
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user } = await requireUser(req);
    if (!user) return json({ error: "Sign in is required." }, 401);
    const admin = serviceClient();
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((me as { role?: string } | null)?.role !== "owner") return json({ error: "Owner access is required." }, 403);

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      request_id?: string;
      payment_ids?: string[];
      outcome?: "denied" | "refunded_in_paypal";
      end_access?: boolean;
      note?: string;
    };

    if (body.action === "list") {
      const { data, error } = await admin
        .from("refund_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return json({ error: "Could not load refund requests." }, 500);
      const requests = (data || []) as RefundRequest[];
      const accounts: Record<string, Account> = {};
      for (const request of requests) {
        const userId = await matchUser(admin, request);
        request.user_id = userId;
        if (userId && !accounts[userId]) accounts[userId] = await loadAccount(admin, userId, request.status === "pending");
      }
      return json({ requests, accounts, windowDays: REFUND_WINDOW_DAYS });
    }

    const requestId = String(body.request_id || "");
    const { data: found } = await admin.from("refund_requests").select("*").eq("id", requestId).maybeSingle();
    const request = found as RefundRequest | null;
    if (!request) return json({ error: "Refund request not found." }, 404);
    if (request.status !== "pending") return json({ error: "This request is already closed." }, 400);
    const note = String(body.note || "").trim().slice(0, 1000) || null;

    if (body.action === "refund") {
      const userId = await matchUser(admin, request);
      if (!userId) return json({ error: "No account uses this email, so refund it in PayPal instead." }, 400);
      const account = await loadAccount(admin, userId, false);
      const wanted = new Set(body.payment_ids || []);
      const selected = account.payments.filter((p) => wanted.has(p.id) && p.status === "completed");
      if (!selected.length) return json({ error: "Choose at least one payment to refund." }, 400);

      const refunded: Payment[] = [];
      const refundIds: string[] = [...(request.paypal_refund_ids || [])];
      let failure = "";
      for (const payment of selected) {
        const result = await refundPayment(payment);
        if (!result.ok) {
          failure = `${payment.label} (${(payment.amountCents / 100).toFixed(2)}): ${result.error}`;
          break;
        }
        refunded.push(payment);
        if (result.refundId) refundIds.push(result.refundId);
        if (payment.kind === "sale") {
          await admin.from("subscription_payments").update({ status: "refunded" }).eq("id", payment.id.slice(3));
        }
      }

      if (refunded.length) await applyAccessChanges(admin, account, refunded);
      const refundedCents = (request.refunded_cents || 0) + refunded.reduce((sum, p) => sum + p.amountCents, 0);
      await admin
        .from("refund_requests")
        .update({
          paypal_refund_ids: refundIds,
          refunded_cents: refundedCents,
          admin_note: note,
          ...(failure ? {} : { status: "refunded", resolved_at: new Date().toISOString(), resolved_by: user.id }),
        })
        .eq("id", request.id);

      if (failure) {
        const done = refunded.length ? ` ${refunded.length} payment(s) were refunded before this one failed.` : "";
        return json({ error: `PayPal could not refund ${failure}.${done}` }, 502);
      }
      return json({ ok: true, refundedCents });
    }

    if (body.action === "close") {
      if (body.outcome !== "denied" && body.outcome !== "refunded_in_paypal") return json({ error: "Choose an outcome." }, 400);
      if (body.outcome === "refunded_in_paypal" && body.end_access) {
        const userId = await matchUser(admin, request);
        if (userId) {
          const account = await loadAccount(admin, userId, false);
          for (const sub of account.subscriptions) {
            if (!sub.refunded_at) await endSubscriptionAccess(admin, sub);
          }
          const windowEnd = account.refundableUntil ? Date.parse(account.refundableUntil) : 0;
          for (const p of account.payments) {
            if (p.kind === "capture" && p.purchaseId && p.status === "completed" && Date.parse(p.paidAt) <= windowEnd) {
              await admin.rpc("revoke_refunded_purchase", { p_purchase_id: p.purchaseId, p_mark_refunded: true });
            }
          }
        }
      }
      await admin
        .from("refund_requests")
        .update({
          status: body.outcome === "denied" ? "denied" : "refunded",
          admin_note: note,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", request.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error("admin-refunds error", err);
    return json({ error: "Refund operation failed." }, 500);
  }
});
