import { json, preflight } from "../_shared/http.ts";
import { comingSoonBlock } from "../_shared/comingSoon.ts";
import { buildCustomId } from "../_shared/billing.ts";
import { dollarsFromCents, paypalFetch } from "../_shared/paypal.ts";
import { productBySlug, requireUser, serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const blocked = await comingSoonBlock(req);
    if (blocked) return blocked;
    const body = await req.json().catch(() => ({}));
    if (!body.acceptedTerms) {
      return json({ error: "Please agree to the Terms of Service, Privacy Policy, and Refund Policy." }, 400);
    }
    const slug = String(body.productSlug || "");
    const quantity = Math.max(1, Number(body.quantity || 1) || 1);
    const includeHousehold = Boolean(body.includeHousehold);
    // Plans go through create-paypal-subscription; a one-time order for one would never expire.
    if (slug !== "upgrade_full") {
      return json({ error: "Unknown product" }, 400);
    }

    const { user } = await requireUser(req);
    if (!user) return json({ error: "Sign in required" }, 401);
    const userId = user.id;

    const product = await productBySlug(slug);
    if (!product) return json({ error: "Product unavailable" }, 400);

    const amountCents = product.amount_cents;
    const description = `Safety Prep List — ${product.name}`;

    const value = dollarsFromCents(amountCents);
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
    const customId = buildCustomId({ slug, quantity, includeHousehold, access: null, discountCode: "" });
    const plan = quantity > 1 ? "family" : String(body.plan || "individual");
    const thankYou = new URL("/thank-you", appUrl);
    thankYou.searchParams.set("plan", plan === "family" ? "family" : "individual");
    thankYou.searchParams.set("qty", String(quantity));
    thankYou.searchParams.set("vault", includeHousehold ? "1" : "0");
    thankYou.searchParams.set("access", "monthly");

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
