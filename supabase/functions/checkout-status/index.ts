import { json, preflight } from "../_shared/http.ts";
import { fulfillCheckoutSession, retrieveCheckoutSession } from "../_shared/fulfill.ts";
import { serviceClient } from "../_shared/supabase.ts";

type PurchaseRow = {
  id: string;
  product_code: string;
  product_type: string;
  user_id: string | null;
  quantity: number | null;
  includes_household: boolean | null;
  access_interval: string | null;
  amount_cents: number | null;
  access_cents: number | null;
  discount_cents: number | null;
  discount_payments: number | null;
};

const PURCHASE_COLS =
  "product_code, product_type, id, user_id, quantity, includes_household, access_interval, amount_cents, access_cents, discount_cents, discount_payments";

async function payload(admin: ReturnType<typeof serviceClient>, row: PurchaseRow, extra: { alreadyProcessed?: boolean } = {}) {
  const quantity = Math.max(1, row.quantity || 1);
  const { data: sub } = await admin
    .from("subscriptions")
    .select("regular_cents, first_payment_cents, discount_cents, discount_payments, purpose")
    .eq("purchase_id", row.id)
    .maybeSingle();
  const subscription = sub as {
    regular_cents?: number;
    first_payment_cents?: number;
    discount_cents?: number;
    discount_payments?: number | null;
    purpose?: string;
  } | null;
  const recurringCents = subscription?.regular_cents ?? row.access_cents ?? 0;
  const paidCents = row.amount_cents ?? subscription?.first_payment_cents ?? recurringCents;
  return {
    productCode: row.product_code,
    productType: row.product_type,
    purchaseId: row.id,
    linkedToUser: Boolean(row.user_id),
    quantity,
    vault: Boolean(row.includes_household),
    access: row.access_interval === "annual" ? "annual" : "monthly",
    plan: quantity > 1 ? "family" : "individual",
    addOn: subscription?.purpose === "add_member",
    paidCents,
    recurringCents,
    discountCents: subscription?.discount_cents ?? row.discount_cents ?? 0,
    discountPayments: subscription?.discount_payments ?? row.discount_payments ?? 1,
    ...extra,
  };
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || "");
    if (!sessionId.startsWith("cs_")) return json({ error: "Missing checkout session" }, 400);

    const admin = serviceClient();
    const existing = await admin.from("purchases").select(PURCHASE_COLS).eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (existing.data) {
      return json(await payload(admin, existing.data as PurchaseRow, { alreadyProcessed: true }));
    }

    const session = await retrieveCheckoutSession(sessionId);
    if (!session) return json({ error: "Payment could not be verified" }, 402);
    const result = await fulfillCheckoutSession(admin, session);
    if (!result.ok) return json({ error: result.error }, result.status);
    const fresh = await admin.from("purchases").select(PURCHASE_COLS).eq("id", result.purchaseId).maybeSingle();
    if (fresh.data) {
      return json(await payload(admin, fresh.data as PurchaseRow, { alreadyProcessed: result.alreadyProcessed }));
    }
    return json({
      ...(result.alreadyProcessed ? { alreadyProcessed: true } : {}),
      productCode: result.productCode,
      productType: result.productType,
      purchaseId: result.purchaseId,
      linkedToUser: result.linkedToUser,
      plan: "individual",
      quantity: 1,
      vault: result.productType === "upgrade_full",
      access: "monthly",
      paidCents: 0,
      recurringCents: 0,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Verification failed" }, 500);
  }
});
