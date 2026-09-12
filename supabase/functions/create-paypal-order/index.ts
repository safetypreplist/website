import { json, preflight } from "../_shared/http.ts";
import { buildCustomId, LAUNCH_PROBE_CENTS, LAUNCH_PROBE_TOKEN, parseAccessInterval } from "../_shared/billing.ts";
import { dollarsFromCents, paypalFetch } from "../_shared/paypal.ts";
import { productBySlug, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body.productSlug || "");
    const isProbe = body.probe === LAUNCH_PROBE_TOKEN && slug === "core";
    const quantity = isProbe ? 1 : Math.max(1, Number(body.quantity || 1) || 1);
    const includeHousehold = isProbe ? false : Boolean(body.includeHousehold);
    const access = slug === "core" ? (isProbe ? "monthly" : parseAccessInterval(body.accessInterval)) : null;
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

    let amountCents = product.amount_cents * (slug === "core" ? 0 : 1);
    let description = `Safety Prep List — ${product.name}`;
    if (slug === "core") {
      if (!access) return json({ error: "Choose Monthly or Annual" }, 400);
      const accessProduct = await productBySlug(access === "annual" ? "access_annual" : "access_monthly");
      if (!accessProduct) return json({ error: "Subscription pricing unavailable" }, 400);
      amountCents = accessProduct.amount_cents * quantity;
      description = quantity > 1
        ? `Safety Prep List Family Plan — ${quantity} personal checklists, ${access === "annual" ? "Annual" : "Monthly"}`
        : `Safety Prep List Individual Plan, ${access === "annual" ? "Annual" : "Monthly"}`;
      if (includeHousehold) {
        const household = await productBySlug("upgrade_full");
        if (!household) return json({ error: "Survival Vault unavailable" }, 400);
        amountCents += household.amount_cents;
        description += " + Survival Vault";
      }
    }

    if (isProbe) {
      amountCents = LAUNCH_PROBE_CENTS;
      description = "Safety Prep List — $0.50 live checkout test";
    }

    const value = dollarsFromCents(amountCents);
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
    const customId = buildCustomId({ slug, quantity, includeHousehold, access }) + (isProbe ? "|p=1" : "");
    const plan = quantity > 1 ? "family" : String(body.plan || "individual");
    const thankYou = new URL("/thank-you", appUrl);
    thankYou.searchParams.set("plan", plan === "family" ? "family" : "individual");
    thankYou.searchParams.set("qty", String(quantity));
    thankYou.searchParams.set("vault", includeHousehold ? "1" : "0");
    thankYou.searchParams.set("access", access || "monthly");
    if (isProbe) thankYou.searchParams.set("probe", LAUNCH_PROBE_TOKEN);

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
