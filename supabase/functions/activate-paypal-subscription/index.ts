import { json, preflight } from "../_shared/http.ts";
import { renewalLine } from "../_shared/billing.ts";
import { incrementDiscountRedemption } from "../_shared/discounts.ts";
import { generateProductCode } from "../_shared/paypal.ts";
import { fetchSubscription, syncSubscription, type SubscriptionRow } from "../_shared/subscriptions.ts";
import { sendPurchaseEmail, serviceClient } from "../_shared/supabase.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const subscriptionId = String(body.subscriptionId || "");
    if (!subscriptionId) return json({ error: "Missing subscriptionId" }, 400);

    const admin = serviceClient();
    const found = await admin
      .from("subscriptions")
      .select("*")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();
    const row = found.data as SubscriptionRow | null;
    if (!row) return json({ error: "Unknown subscription" }, 404);

    if (row.purchase_id) {
      const prior = await admin.from("purchases").select("id, product_code, product_type").eq("id", row.purchase_id).maybeSingle();
      if (prior.data) {
        return json({
          alreadyProcessed: true,
          productCode: prior.data.product_code,
          productType: prior.data.product_type,
          purchaseId: prior.data.id,
        });
      }
    }

    // PayPal can report APPROVED for a few seconds before the subscription becomes ACTIVE.
    let remote = await fetchSubscription(subscriptionId);
    for (let attempt = 0; attempt < 5 && remote && remote.status !== "ACTIVE"; attempt++) {
      await wait(2000);
      remote = await fetchSubscription(subscriptionId);
    }
    if (!remote || remote.status !== "ACTIVE") {
      return json({ error: "PayPal has not confirmed the subscription yet. Refresh this page in a minute." }, 402);
    }
    if (remote.plan_id !== row.paypal_plan_id) {
      console.error("Plan mismatch", remote.plan_id, row.paypal_plan_id);
      return json({ error: "Subscription did not match the selected plan" }, 402);
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
        paypal_subscription_id: subscriptionId,
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
      const raced = await admin
        .from("purchases")
        .select("id, product_code, product_type")
        .eq("paypal_subscription_id", subscriptionId)
        .maybeSingle();
      if (raced.data) {
        return json({
          alreadyProcessed: true,
          productCode: raced.data.product_code,
          productType: raced.data.product_type,
          purchaseId: raced.data.id,
        });
      }
      console.error(insert.error);
      return json({ error: "Could not record purchase" }, 500);
    }

    await admin.from("subscriptions").update({ purchase_id: insert.data.id }).eq("id", row.id);
    await syncSubscription(admin, row, remote);

    if (row.user_id) {
      const rpc = row.purpose === "renew" ? "link_purchase_subscription" : "apply_purchase_entitlements";
      const applied = await admin.rpc(rpc, { p_purchase_id: insert.data.id });
      if (applied.error) console.error(applied.error);
    }

    if (row.discount_code) await incrementDiscountRedemption(row.discount_code);

    const emailTo = payerEmail;
    if (emailTo) {
      const billingLabel = row.access_interval === "annual" ? "Annual" : "Monthly";
      const vault = row.vault_cents > 0 ? " + Survival Vault" : "";
      await sendPurchaseEmail({
        to: emailTo,
        planName: row.quantity > 1
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

    return json({
      productCode,
      productType: "core",
      purchaseId: insert.data.id,
      linkedToUser: Boolean(row.user_id),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Verification failed" }, 500);
  }
});
