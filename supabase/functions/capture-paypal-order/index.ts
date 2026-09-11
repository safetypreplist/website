import { json, preflight } from "../_shared/http.ts";
import { parseAccessInterval, parseCustomId } from "../_shared/billing.ts";
import { generateProductCode, paypalFetch } from "../_shared/paypal.ts";
import {
  productBySlug,
  requireUser,
  sendPurchaseEmail,
  serviceClient,
} from "../_shared/supabase.ts";

function captureAmount(captureBody: Record<string, unknown>) {
  const units = (captureBody.purchase_units as Array<Record<string, unknown>>) || [];
  const payments = (units[0]?.payments as Record<string, unknown>) || {};
  const captures = (payments.captures as Array<Record<string, unknown>>) || [];
  const cap = captures[0] || {};
  const amount = (cap.amount as Record<string, string>) || {};
  return {
    captureId: String(cap.id || ""),
    status: String(cap.status || ""),
    value: String(amount.value || ""),
    currency: String(amount.currency_code || "USD"),
    customId: String(units[0]?.custom_id || ""),
    payerEmail:
      String(
        ((captureBody.payer as Record<string, unknown>)?.email_address as string) ||
          "",
      ) || null,
  };
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || "");
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    const { user } = await requireUser(req);
    const admin = serviceClient();

    const existing = await admin
      .from("purchases")
      .select("*")
      .eq("paypal_order_id", orderId)
      .maybeSingle();

    if (existing.data && existing.data.payment_status === "completed") {
      return json({
        alreadyProcessed: true,
        productCode: existing.data.product_code,
        productType: existing.data.product_type,
        purchaseId: existing.data.id,
      });
    }

    const captured = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      body: "{}",
    });

    if (!captured.ok) {
      const order = await paypalFetch(`/v2/checkout/orders/${orderId}`);
      const orderBody = order.body as Record<string, unknown>;
      if (orderBody?.status !== "COMPLETED") {
        console.error("PayPal capture failed", captured.status, captured.body);
        return json({ error: "Payment could not be verified" }, 402);
      }
      captured.body = orderBody;
      captured.ok = true;
    }

    const details = captureAmount(captured.body as Record<string, unknown>);
    if (details.status && details.status !== "COMPLETED") {
      return json({ error: "Payment not completed" }, 402);
    }

    const custom = details.customId || "";
    const parsed = parseCustomId(custom, String(body.productSlug || ""));
    const slug = parsed.slug;
    const quantity = parsed.quantity;
    const includeHousehold = parsed.includeHousehold;
    const access = parsed.access || parseAccessInterval(body.accessInterval);
    const product = await productBySlug(slug);
    if (!product) return json({ error: "Unknown product on order" }, 400);

    let checklistCents = 0;
    let accessCents = 0;
    let vaultCents = 0;
    let expected = slug === "core" ? 0 : product.amount_cents;
    if (slug === "core") {
      if (!access) return json({ error: "Billing selection missing from payment" }, 400);
      const accessProduct = await productBySlug(access === "annual" ? "access_annual" : "access_monthly");
      accessCents = (accessProduct?.amount_cents || 0) * quantity;
      expected = accessCents;
      if (includeHousehold) {
        const household = await productBySlug("upgrade_full");
        vaultCents = household?.amount_cents || 0;
        expected += vaultCents;
      }
    }

    const paidCents = Math.round(parseFloat(details.value) * 100);
    if (paidCents !== expected) {
      console.error("Amount mismatch", paidCents, expected);
      return json({ error: "Payment amount did not match the product" }, 402);
    }

    if (product.kind === "upgrade_full" && !user) {
      return json({ error: "Sign in required for this product" }, 401);
    }

    let productCode = generateProductCode();
    for (let i = 0; i < 5; i++) {
      const clash = await admin
        .from("purchases")
        .select("id")
        .eq("product_code", productCode)
        .maybeSingle();
      if (!clash.data) break;
      productCode = generateProductCode();
    }

    const insert = await admin
      .from("purchases")
      .insert({
        user_id: user?.id ?? null,
        provider: "paypal",
        paypal_order_id: orderId,
        paypal_capture_id: details.captureId,
        product_code: productCode,
        product_type: product.kind,
        amount_cents: paidCents,
        currency: product.currency,
        payment_status: "completed",
        payer_email: details.payerEmail,
        raw_payload: captured.body,
        completed_at: new Date().toISOString(),
        quantity,
        includes_household: includeHousehold,
        access_interval: access,
        checklist_cents: checklistCents,
        access_cents: accessCents,
        vault_cents: vaultCents,
      })
      .select("*")
      .single();

    if (insert.error) {
      console.error(insert.error);
      const raced = await admin
        .from("purchases")
        .select("*")
        .eq("paypal_order_id", orderId)
        .maybeSingle();
      if (raced.data?.payment_status === "completed") {
        return json({
          alreadyProcessed: true,
          productCode: raced.data.product_code,
          productType: raced.data.product_type,
          purchaseId: raced.data.id,
        });
      }
      return json({ error: "Could not record purchase" }, 500);
    }

    if (insert.data.user_id) {
      await admin.rpc("apply_purchase_entitlements", {
        p_purchase_id: insert.data.id,
      });
    }

    const emailTo = details.payerEmail || user?.email;
    if (emailTo) {
      const billingLabel = access === "annual" ? "Annual" : access === "monthly" ? "Monthly" : "";
      await sendPurchaseEmail({
        to: emailTo,
        planName: quantity > 1
          ? `Family Plan (${quantity} personal checklists)${billingLabel ? `, ${billingLabel}` : ""}${includeHousehold ? " + Survival Vault" : ""}`
          : includeHousehold
            ? `Individual Plan${billingLabel ? `, ${billingLabel}` : ""} + Survival Vault`
            : `${quantity > 1 ? "Family Plan" : "Individual Plan"}${billingLabel ? `, ${billingLabel}` : ""}`,
        productCode,
        deviceAllowance: access === "annual"
          ? "Renews annually at the same subscription amount. Survival Vault, if purchased, does not renew."
          : access === "monthly"
            ? "Renews monthly at the same subscription amount. Survival Vault, if purchased, does not renew."
            : "Your Safety Prep List purchase is complete.",
      });
    }

    return json({
      productCode,
      productType: product.kind,
      purchaseId: insert.data.id,
      amountCents: product.amount_cents,
      linkedToUser: Boolean(insert.data.user_id),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Verification failed" }, 500);
  }
});
