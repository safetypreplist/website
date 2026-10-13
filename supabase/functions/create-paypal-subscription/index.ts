import { json, preflight } from "../_shared/http.ts";
import { buildCustomId, parseAccessInterval } from "../_shared/billing.ts";
import {
  isDiscountUsable,
  loadDiscount,
  normalizeCode,
  planKindFromQuantity,
  quoteWithDiscount,
} from "../_shared/discounts.ts";
import { paypalFetch } from "../_shared/paypal.ts";
import { ensurePlan, ensureWebhook } from "../_shared/subscriptions.ts";
import { productBySlug, requireUser, serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.acceptedTerms) {
      return json({ error: "Please agree to the Terms of Service, Privacy Policy, and Refund Policy." }, 400);
    }
    const access = parseAccessInterval(body.accessInterval);
    if (!access) return json({ error: "Choose Monthly or Annual" }, 400);

    const admin = serviceClient();
    const { user } = await requireUser(req);
    const renew = Boolean(body.renew);
    if (renew && !user) return json({ error: "Sign in to renew your plan." }, 401);

    let purpose: "new" | "add_member" | "renew" = "new";
    let quantity = Math.max(1, Number(body.quantity || 1) || 1);
    let includeVault = Boolean(body.includeHousehold);

    if (renew && user) {
      purpose = "renew";
      includeVault = false;
      const lapsed = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["cancelled", "expired", "suspended"]);
      const lapsedIds = ((lapsed.data || []) as Array<{ id: string }>).map((row) => row.id);
      if (!lapsedIds.length) return json({ error: "There is no ended plan to renew." }, 400);
      const { count } = await admin
        .from("personal_checklists")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .in("subscription_id", lapsedIds);
      quantity = Math.max(1, count || 1);
    } else if (user) {
      const { data: own } = await admin
        .from("personal_checklists")
        .select("id")
        .eq("owner_user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (own) purpose = "add_member";
    }

    const accessProduct = await productBySlug(access === "annual" ? "access_annual" : "access_monthly");
    if (!accessProduct) return json({ error: "Subscription pricing unavailable" }, 400);
    const subscriptionCents = accessProduct.amount_cents * quantity;

    let vaultCents = 0;
    if (includeVault) {
      const vault = await productBySlug("upgrade_full");
      if (!vault) return json({ error: "Survival Vault unavailable" }, 400);
      vaultCents = vault.amount_cents;
    }

    const planKind = planKindFromQuantity(quantity, body.plan);
    const requestedCode = normalizeCode(body.discountCode);
    let discountCode = "";
    let discountCents = 0;
    let discountPayments = 0;
    if (requestedCode) {
      const row = await loadDiscount(requestedCode);
      const quote = quoteWithDiscount({ row, planKind, subscriptionCents, vaultCents, quantity, interval: access });
      if (!isDiscountUsable(row) || !row || !quote.discountCents) {
        return json({ error: "That code is not active or does not apply to this plan." }, 400);
      }
      discountCode = row.code;
      discountCents = quote.discountCents;
      discountPayments = Math.max(1, row.discount_payments || 1);
    }

    const trialCents = discountCents > 0 ? subscriptionCents - discountCents : null;
    const planId = await ensurePlan(admin, {
      interval: access,
      quantity,
      regularCents: subscriptionCents,
      trialCents,
      trialCycles: discountCents > 0 ? discountPayments : 0,
      setupCents: vaultCents,
    });
    await ensureWebhook(admin);

    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
    const thankYou = new URL("/thank-you", appUrl);
    thankYou.searchParams.set("plan", quantity > 1 ? "family" : "individual");
    thankYou.searchParams.set("qty", String(quantity));
    thankYou.searchParams.set("vault", includeVault ? "1" : "0");
    thankYou.searchParams.set("access", access);

    const created = await paypalFetch("/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        custom_id: buildCustomId({ slug: "core", quantity, includeHousehold: includeVault, access, discountCode }),
        application_context: {
          brand_name: "Safety Prep List",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: thankYou.toString(),
          cancel_url: `${appUrl}/#pricing`,
        },
      }),
    });
    if (!created.ok) {
      console.error("PayPal subscription create failed", created.status, created.body);
      return json({ error: "Could not start PayPal checkout" }, 502);
    }
    const subscriptionId = (created.body as { id: string }).id;

    const firstPaymentCents = vaultCents + (trialCents ?? subscriptionCents);
    const insert = await admin.from("subscriptions").insert({
      paypal_subscription_id: subscriptionId,
      paypal_plan_id: planId,
      user_id: user?.id ?? null,
      purpose,
      access_interval: access,
      quantity,
      regular_cents: subscriptionCents,
      first_payment_cents: firstPaymentCents,
      vault_cents: vaultCents,
      discount_code: discountCode || null,
      discount_cents: discountCents,
      discount_payments: discountCents > 0 ? discountPayments : null,
    });
    if (insert.error) {
      console.error(insert.error);
      return json({ error: "Could not start PayPal checkout" }, 500);
    }

    try {
      await admin.from("terms_acceptances").insert({
        user_id: user?.id ?? null,
        email: null,
        terms_version: String(body.termsVersion || ""),
        privacy_version: String(body.privacyVersion || ""),
        refund_version: String(body.refundVersion || ""),
        ip_address: (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null,
        user_agent: req.headers.get("user-agent"),
        context: "checkout",
      });
    } catch (err) {
      console.error("Could not record checkout agreement", err);
    }

    return json({ subscriptionId, quantity, firstPaymentCents });
  } catch (err) {
    console.error(err);
    return json({ error: "Checkout failed" }, 500);
  }
});
