import { paypalFetch } from "./paypal.ts";
import { syncSubscription, type SubscriptionRow } from "./subscriptions.ts";
import { serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

/** Cancels the PayPal subscription if it is still live, ends access now, and revokes the linked purchase. */
export async function endSubscriptionAccess(admin: Admin, sub: SubscriptionRow) {
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

export async function endAccessForSale(admin: Admin, saleId: string) {
  const { data: payment } = await admin
    .from("subscription_payments")
    .select("subscription_id")
    .eq("paypal_sale_id", saleId)
    .maybeSingle();
  const subscriptionId = (payment as { subscription_id?: string } | null)?.subscription_id;
  if (!subscriptionId) return;
  const { data: sub } = await admin.from("subscriptions").select("*").eq("id", subscriptionId).maybeSingle();
  if (sub) await endSubscriptionAccess(admin, sub as SubscriptionRow);
}

export async function endAccessForCapture(admin: Admin, captureId: string) {
  if (!captureId) return;
  const byCapture = await admin.from("purchases").select("id").eq("paypal_capture_id", captureId).maybeSingle();
  const row = byCapture.data ?? (await admin.from("purchases").select("id").eq("paypal_order_id", captureId).maybeSingle()).data;
  const id = (row as { id?: string } | null)?.id;
  if (id) await admin.rpc("revoke_refunded_purchase", { p_purchase_id: id, p_mark_refunded: true });
}
