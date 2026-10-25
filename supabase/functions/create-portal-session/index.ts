import { json, preflight } from "../_shared/http.ts";
import { isStripeConfigured, stripeErrorMessage, stripeRequest } from "../_shared/stripe.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isStripeConfigured()) return json({ error: "Stripe is not configured yet." }, 503);

  try {
    const { user } = await requireUser(req);
    if (!user) return json({ error: "Sign in required" }, 401);
    const admin = serviceClient();
    const { data } = await admin.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
    const customer = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
    if (!customer) return json({ error: "No Stripe billing account is on file yet." }, 400);
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
    const session = await stripeRequest<{ url?: string }>("POST", "/billing_portal/sessions", {
      customer,
      return_url: `${appUrl}/app/billing`,
    });
    if (!session.ok || !session.body.url) {
      return json({ error: stripeErrorMessage(session.body, "Could not open billing portal.") }, 502);
    }
    return json({ url: session.body.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not open billing portal" }, 500);
  }
});
