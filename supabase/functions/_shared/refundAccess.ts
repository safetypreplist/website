import { cancelRemoteNow } from "./cancelRemote.ts";
import { syncSubscription, type SubscriptionRow } from "./subscriptions.ts";
import { serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

/** Cancels the PayPal subscription if it is still live, ends access now, and revokes the linked purchase. */
export async function endSubscriptionAccess(admin: Admin, sub: SubscriptionRow) {
  if (sub.status === "active" || sub.status === "suspended") {
    await cancelRemoteNow(sub);
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
  const byPaypal = await admin.from("subscription_payments").select("subscription_id").eq("paypal_sale_id", saleId).maybeSingle();
  const byInvoice = await admin.from("subscription_payments").select("subscription_id").eq("stripe_invoice_id", saleId).maybeSingle();
  const byCharge = await admin.from("subscription_payments").select("subscription_id").eq("stripe_charge_id", saleId).maybeSingle();
  const payment = byPaypal.data ?? byInvoice.data ?? byCharge.data;
  const subscriptionId = (payment as { subscription_id?: string } | null)?.subscription_id;
  if (!subscriptionId) return;
  const { data: sub } = await admin.from("subscriptions").select("*").eq("id", subscriptionId).maybeSingle();
  if (sub) await endSubscriptionAccess(admin, sub as SubscriptionRow);
}

export async function endAccessForCapture(admin: Admin, captureId: string) {
  if (!captureId) return;
  const byCapture = await admin.from("purchases").select("id").eq("paypal_capture_id", captureId).maybeSingle();
  const row =
    byCapture.data ??
    (await admin.from("purchases").select("id").eq("paypal_order_id", captureId).maybeSingle()).data ??
    (await admin.from("purchases").select("id").eq("stripe_payment_intent_id", captureId).maybeSingle()).data;
  const id = (row as { id?: string } | null)?.id;
  if (id) await admin.rpc("revoke_refunded_purchase", { p_purchase_id: id, p_mark_refunded: true });
}
