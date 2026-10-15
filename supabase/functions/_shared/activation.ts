import { renewalLine } from "./billing.ts";
import { incrementDiscountRedemption } from "./discounts.ts";
import { generateProductCode } from "./paypal.ts";
import {
  fetchSubscription,
  syncSubscription,
  type SubscriptionRow,
} from "./subscriptions.ts";
import { sendPurchaseEmail, serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ActivationResult =
  | { ok: true; alreadyProcessed: boolean; productCode: string; productType: string; purchaseId: string; linkedToUser: boolean }
  | { ok: false; status: number; error: string };

async function priorPurchase(admin: Admin, filter: { id?: string; subscriptionId?: string }) {
  const query = admin.from("purchases").select("id, product_code, product_type, user_id");
  const { data } = filter.id
    ? await query.eq("id", filter.id).maybeSingle()
    : await query.eq("paypal_subscription_id", filter.subscriptionId!).maybeSingle();
  return data as { id: string; product_code: string; product_type: string; user_id: string | null } | null;
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

// Turns an approved PayPal subscription into a purchase, checklists and a receipt email.
// The browser calls this when the buyer returns from PayPal, and the PayPal webhook calls it too,
// so a buyer who closes the tab right after approving still gets set up. Whichever runs first does
// the work; the database allows only one purchase per subscription, so the other just reads it back.
export async function activateSubscription(
  admin: Admin,
  row: SubscriptionRow,
  options: { waitForActive: boolean },
): Promise<ActivationResult> {
  if (row.purchase_id) {
    const prior = await priorPurchase(admin, { id: row.purchase_id });
    if (prior) return processed(prior);
  }

  // PayPal can report APPROVED for a few seconds before the subscription becomes ACTIVE.
  let remote = await fetchSubscription(row.paypal_subscription_id);
  if (options.waitForActive) {
    for (let attempt = 0; attempt < 5 && remote && remote.status !== "ACTIVE"; attempt++) {
      await wait(2000);
      remote = await fetchSubscription(row.paypal_subscription_id);
    }
  }
  if (!remote || remote.status !== "ACTIVE") {
    return { ok: false, status: 402, error: "PayPal has not confirmed the subscription yet. Refresh this page in a minute." };
  }
  if (remote.plan_id !== row.paypal_plan_id) {
    console.error("Plan mismatch", remote.plan_id, row.paypal_plan_id);
    return { ok: false, status: 402, error: "Subscription did not match the selected plan" };
  }

  let productCode = generateProductCode();
  for (let i = 0; i < 5; i++) {
    const clash = await admin.from("purchases").select("id").eq("product_code", productCode).maybeSingle();
    if (!clash.data) break;
    productCode = generateProductCode();
  }

  const payerEmail = remote.subscriber?.email_address || null;
  const insert = await admin
    .from("purchases")
    .insert({
      user_id: row.user_id,
      provider: "paypal",
      paypal_subscription_id: row.paypal_subscription_id,
      product_code: productCode,
      product_type: "core",
      amount_cents: row.first_payment_cents,
      currency: "USD",
      payment_status: "completed",
      payer_email: payerEmail,
      raw_payload: remote,
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
    // The other caller won the race; hand back what it created.
    const raced = await priorPurchase(admin, { subscriptionId: row.paypal_subscription_id });
    if (raced) return processed(raced);
    console.error(insert.error);
    return { ok: false, status: 500, error: "Could not record purchase" };
  }

  await admin.from("subscriptions").update({ purchase_id: insert.data.id }).eq("id", row.id);
  await syncSubscription(admin, row, remote);

  if (row.user_id) {
    const rpc = row.purpose === "renew" ? "link_purchase_subscription" : "apply_purchase_entitlements";
    const applied = await admin.rpc(rpc, { p_purchase_id: insert.data.id });
    if (applied.error) console.error(applied.error);
  }

  if (row.discount_code) await incrementDiscountRedemption(row.discount_code);

  if (payerEmail) {
    const billingLabel = row.access_interval === "annual" ? "Annual" : "Monthly";
    const vault = row.vault_cents > 0 ? " + Survival Vault" : "";
    await sendPurchaseEmail({
      to: payerEmail,
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
