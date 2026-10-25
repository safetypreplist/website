import { json } from "../_shared/http.ts";
import {
  endAccessForStripeInvoice,
  fulfillCheckoutSession,
  recordInvoicePayment,
  retrieveCheckoutSession,
} from "../_shared/fulfill.ts";
import { verifyStripeSignature } from "../_shared/stripe.ts";
import { syncStripeSubscription, type SubscriptionRow } from "../_shared/subscriptions.ts";
import { serviceClient } from "../_shared/supabase.ts";

function objectId(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return (value as { id?: string }).id || null;
}

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
    const object = event.data?.object || {};
    const type = event.type;

    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const session = await retrieveCheckoutSession(String(object.id || ""));
      if (session) {
        const result = await fulfillCheckoutSession(admin, session);
        if (!result.ok && result.status !== 402) {
          console.error("Stripe checkout fulfill failed", object.id, result.error);
          return json({ error: "Could not set up purchase" }, 500);
        }
      }
    } else if (type === "checkout.session.async_payment_failed") {
      const localId = (object.metadata as { subscription_id?: string } | undefined)?.subscription_id;
      if (localId) {
        await admin.from("subscriptions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", localId);
      }
    } else if (type === "invoice.paid" || type === "invoice.payment_failed") {
      await recordInvoicePayment(admin, object);
      if (type === "invoice.paid") {
        const sessionId = objectId((object.parent as { subscription_details?: { metadata?: Record<string, string> } } | undefined)?.subscription_details);
        void sessionId;
        const stripeSub = objectId(object.subscription);
        if (stripeSub) {
          const found = await admin.from("subscriptions").select("*").eq("stripe_subscription_id", stripeSub).maybeSingle();
          const row = found.data as SubscriptionRow | null;
          if (row && !row.purchase_id) {
            const checkoutId = row.stripe_checkout_session_id;
            if (checkoutId) {
              const session = await retrieveCheckoutSession(checkoutId);
              if (session) await fulfillCheckoutSession(admin, session);
            }
          }
        }
      }
    } else if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const stripeSub = String(object.id || "");
      const found = await admin.from("subscriptions").select("*").eq("stripe_subscription_id", stripeSub).maybeSingle();
      if (found.data) await syncStripeSubscription(admin, found.data as SubscriptionRow, object);
    } else if (type === "charge.refunded" || type === "charge.dispute.created" || type === "radar.early_fraud_warning.created") {
      const invoiceId = objectId(object.invoice);
      const subFromInvoice = objectId((object.payment_intent as { invoice?: unknown } | undefined)?.invoice);
      const charge = object as { invoice?: unknown; payment_intent?: unknown };
      await endAccessForStripeInvoice(admin, invoiceId || objectId(charge.invoice), objectId(object.subscription) || subFromInvoice);
      const pi = objectId(object.payment_intent) || objectId((object as { charge?: unknown }).charge);
      if (pi) {
        const purchase =
          (await admin.from("purchases").select("id").eq("stripe_payment_intent_id", pi).maybeSingle()).data ??
          (await admin.from("purchases").select("id").eq("stripe_invoice_id", invoiceId || "").maybeSingle()).data;
        const id = (purchase as { id?: string } | null)?.id;
        if (id) await admin.rpc("revoke_refunded_purchase", { p_purchase_id: id, p_mark_refunded: true });
      }
    }

    await admin.from("stripe_events").insert({ id: event.id, type: event.type });
    return json({ ok: true });
  } catch (err) {
    console.error("Stripe webhook error", err);
    return json({ error: "Could not process webhook" }, 500);
  }
});
