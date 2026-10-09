import { json, preflight } from "../_shared/http.ts";
import { buildCustomId, parseAccessInterval } from "../_shared/billing.ts";
import {
  isDiscountUsable,
  loadDiscount,
  normalizeCode,
  planKindFromQuantity,
  quoteWithDiscount,
} from "../_shared/discounts.ts";
import { dollarsFromCents, paypalFetch } from "../_shared/paypal.ts";
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
    const slug = String(body.productSlug || "");
    const quantity = Math.max(1, Number(body.quantity || 1) || 1);
    const includeHousehold = Boolean(body.includeHousehold);
    const access = slug === "core" ? parseAccessInterval(body.accessInterval) : null;
    const allowedGuest = ["core"];
    const allowedAuth = ["upgrade_full", "core"];

    if (![...allowedGuest, ...allowedAuth].includes(slug)) {
      return json({ error: "Unknown product" }, 400);
    }

    let userId: string | null = null;
    if (slug === "upgrade_full") {
      const { user } = await requireUser(req);
      if (!user) return json({ error: "Sign in required" }, 401);
      userId = user.id;
    } else {
      const { user } = await requireUser(req);
      userId = user?.id ?? null;
    }

    const product = await productBySlug(slug);
    if (!product) return json({ error: "Product unavailable" }, 400);

    let subscriptionCents = 0;
    let vaultCents = 0;
    let amountCents = product.amount_cents * (slug === "core" ? 0 : 1);
    let description = `Safety Prep List — ${product.name}`;
    const planKind = planKindFromQuantity(quantity, body.plan);
    const requestedCode = normalizeCode(body.discountCode);
    if (slug === "core") {
      if (!access) return json({ error: "Choose Monthly or Annual" }, 400);
      const accessProduct = await productBySlug(access === "annual" ? "access_annual" : "access_monthly");
      if (!accessProduct) return json({ error: "Subscription pricing unavailable" }, 400);
      subscriptionCents = accessProduct.amount_cents * quantity;
      amountCents = subscriptionCents;
      description = quantity > 1
        ? `Safety Prep List Family Plan — ${quantity} personal checklists, ${access === "annual" ? "Annual" : "Monthly"}`
        : `Safety Prep List Individual Plan, ${access === "annual" ? "Annual" : "Monthly"}`;
      if (includeHousehold) {
        const household = await productBySlug("upgrade_full");
        if (!household) return json({ error: "Survival Vault unavailable" }, 400);
        vaultCents = household.amount_cents;
        amountCents += vaultCents;
        description += " + Survival Vault";
      }
    }

    let discountCode = "";
    if (requestedCode && slug === "core") {
      const row = await loadDiscount(requestedCode);
      const quote = quoteWithDiscount({ row, planKind, subscriptionCents, vaultCents, quantity });
      if (!isDiscountUsable(row) || !row || !quote.discountCents) {
        return json({ error: "That code is not active or does not apply to this plan." }, 400);
      }
      discountCode = row.code;
      amountCents = quote.dueTodayCents;
      description += ` (${row.code})`;
    }

    const value = dollarsFromCents(amountCents);
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
    const customId = buildCustomId({ slug, quantity, includeHousehold, access, discountCode });
    const plan = quantity > 1 ? "family" : String(body.plan || "individual");
    const thankYou = new URL("/thank-you", appUrl);
    thankYou.searchParams.set("plan", plan === "family" ? "family" : "individual");
    thankYou.searchParams.set("qty", String(quantity));
    thankYou.searchParams.set("vault", includeHousehold ? "1" : "0");
    thankYou.searchParams.set("access", access || "monthly");

    const { ok, status, body: paypalBody } = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: customId,
            description,
            amount: {
              currency_code: product.currency || "USD",
              value,
            },
          },
        ],
        application_context: {
          brand_name: "Safety Prep List",
          user_action: "PAY_NOW",
          return_url: thankYou.toString(),
          cancel_url: `${appUrl}/pricing`,
        },
      }),
    });

    if (!ok) {
      console.error("PayPal create order failed", status, paypalBody);
      return json({ error: "Could not start PayPal checkout" }, 502);
    }

    const order = paypalBody as { id: string };
    try {
      await serviceClient().from("terms_acceptances").insert({
        user_id: userId,
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
    return json({
      orderId: order.id,
      productSlug: product.slug,
      amountCents,
      currency: product.currency,
      userId,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Checkout failed" }, 500);
  }
});
