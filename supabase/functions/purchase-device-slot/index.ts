import { json, preflight } from "../_shared/http.ts";
import { dollarsFromCents, paypalFetch } from "../_shared/paypal.ts";
import { productBySlug, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { user } = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const product = await productBySlug("extra_device");
  if (!product) return json({ error: "Product unavailable" }, 400);

  const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
  const created = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: "extra_device",
          description: "Safety Prep List — Additional Device",
          amount: {
            currency_code: product.currency,
            value: dollarsFromCents(product.amount_cents),
          },
        },
      ],
      application_context: {
        brand_name: "Safety Prep List",
        user_action: "PAY_NOW",
        return_url: `${appUrl}/app/devices`,
        cancel_url: `${appUrl}/app/devices`,
      },
    }),
  });

  if (!created.ok) return json({ error: "Could not start PayPal checkout" }, 502);
  const order = created.body as { id: string };
  return json({ orderId: order.id, amountCents: product.amount_cents });
});
