import { json } from "../_shared/http.ts";
import { fulfillCheckoutSession, retrieveCheckoutSession } from "../_shared/fulfill.ts";
import { verifyStripeSignature } from "../_shared/stripe.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const payload = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const header = req.headers.get("stripe-signature") || "";
  if (!secret || !(await verifyStripeSignature(payload, header, secret))) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid event" }, 400);
  }
  if (!event.id || !event.type) return json({ error: "Invalid event" }, 400);

  const admin = serviceClient();
  const seen = await admin.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen.data) return json({ ok: true, duplicate: true });

  try {
    const type = event.type;
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const object = event.data?.object || {};
      const session = await retrieveCheckoutSession(String(object.id || ""));
      if (session) {
        const result = await fulfillCheckoutSession(admin, session);
        if (!result.ok && result.status !== 402) {
          console.error("Stripe checkout fulfill failed", object.id, result.error);
          return json({ error: "Could not issue license" }, 500);
        }
      }
    }
    // Subscription / invoice / customer.subscription.* handlers removed (one-time licenses only).

    await admin.from("stripe_events").insert({ id: event.id, type: event.type });
    return json({ ok: true });
  } catch (err) {
    console.error("Stripe webhook error", err);
    return json({ error: "Could not process webhook" }, 500);
  }
});
