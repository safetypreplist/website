import { json } from "../_shared/http.ts";
import { paypalFetch } from "../_shared/paypal.ts";
import { refKey, syncSubscription, type SubscriptionRow } from "../_shared/subscriptions.ts";
import { serviceClient } from "../_shared/supabase.ts";

type WebhookEvent = {
  id: string;
  event_type: string;
  resource_type?: string;
  resource?: {
    id?: string;
    billing_agreement_id?: string;
    sale_id?: string;
    amount?: { total?: string };
    create_time?: string;
    billing_info?: {
      last_failed_payment?: { amount?: { value?: string }; time?: string; reason_code?: string };
    };
  };
};

async function verify(req: Request, event: WebhookEvent, webhookId: string) {
  const header = (name: string) => req.headers.get(name) || "";
  const res = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: header("paypal-auth-algo"),
      cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"),
      transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  return res.ok && (res.body as { verification_status?: string })?.verification_status === "SUCCESS";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const event = (await req.json().catch(() => null)) as WebhookEvent | null;
    if (!event?.event_type) return json({ error: "Invalid event" }, 400);

    const admin = serviceClient();
    const ref = await admin.from("paypal_billing_refs").select("paypal_id").eq("key", refKey("webhook")).maybeSingle();
    const webhookId = (ref.data as { paypal_id: string } | null)?.paypal_id;
    if (!webhookId || !req.headers.get("paypal-transmission-sig") || !(await verify(req, event, webhookId))) {
      return json({ error: "Invalid webhook signature" }, 401);
    }

    if (event.event_type === "PAYMENT.SALE.REFUNDED" || event.event_type === "PAYMENT.SALE.REVERSED") {
      const saleId = event.resource?.sale_id || event.resource?.id;
      if (saleId) {
        await admin.from("subscription_payments").update({ status: "refunded" }).eq("paypal_sale_id", saleId);
      }
      return json({ ok: true });
    }

    const isSale = event.event_type.startsWith("PAYMENT.SALE");
    const paypalSubscriptionId = isSale ? event.resource?.billing_agreement_id : event.resource?.id;
    if (!paypalSubscriptionId) return json({ ok: true, ignored: true });

    const found = await admin
      .from("subscriptions")
      .select("*")
      .eq("paypal_subscription_id", paypalSubscriptionId)
      .maybeSingle();
    const row = found.data as SubscriptionRow | null;
    if (!row) return json({ ok: true, ignored: true });

    if (event.event_type === "PAYMENT.SALE.COMPLETED" && event.resource?.id) {
      await admin.from("subscription_payments").upsert(
        {
          subscription_id: row.id,
          paypal_sale_id: event.resource.id,
          amount_cents: Math.round(parseFloat(event.resource.amount?.total || "0") * 100),
          paid_at: event.resource.create_time || new Date().toISOString(),
        },
        { onConflict: "paypal_sale_id", ignoreDuplicates: true },
      );
    }

    if (event.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
      const failed = event.resource?.billing_info?.last_failed_payment;
      await admin.from("subscription_payments").upsert(
        {
          subscription_id: row.id,
          paypal_sale_id: `failed:${event.id}`,
          amount_cents: Math.round(parseFloat(failed?.amount?.value || "0") * 100) || row.regular_cents,
          paid_at: failed?.time || event.resource?.create_time || new Date().toISOString(),
          status: "failed",
          failure_reason: failed?.reason_code || null,
        },
        { onConflict: "paypal_sale_id", ignoreDuplicates: true },
      );
    }

    await syncSubscription(admin, row);
    return json({ ok: true });
  } catch (err) {
    console.error("PayPal webhook error", err);
    return json({ error: "Could not process webhook" }, 500);
  }
});
