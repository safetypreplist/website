import { paypalFetch } from "./paypal.ts";
import { stripeRequest } from "./stripe.ts";
import type { SubscriptionRow } from "./subscriptions.ts";

export async function cancelRemoteSubscription(row: SubscriptionRow, reason: string) {
  if (row.stripe_subscription_id) {
    const res = await stripeRequest("POST", `/subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`, {
      cancel_at_period_end: true,
      cancellation_details: { comment: reason.slice(0, 1000) },
    });
    if (!res.ok && res.status !== 404) {
      const status = (res.body as { error?: { code?: string; message?: string } } | null)?.error;
      if (status?.code !== "resource_missing") {
        return { ok: false as const, processor: "stripe" as const, status: res.status, body: res.body };
      }
    }
    return { ok: true as const, processor: "stripe" as const };
  }
  if (row.paypal_subscription_id) {
    const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(row.paypal_subscription_id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    if (!res.ok && res.status !== 422) {
      return { ok: false as const, processor: "paypal" as const, status: res.status, body: res.body };
    }
    return { ok: true as const, processor: "paypal" as const };
  }
  return { ok: true as const, processor: "none" as const };
}

export async function cancelRemoteNow(row: SubscriptionRow) {
  if (row.stripe_subscription_id) {
    const res = await stripeRequest("DELETE", `/subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`);
    if (!res.ok && res.status !== 404) {
      console.error("Stripe cancel after refund failed", res.status, res.body);
    }
    return;
  }
  if (row.paypal_subscription_id) {
    const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(row.paypal_subscription_id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Refunded" }),
    });
    if (!res.ok && res.status !== 422) console.error("PayPal cancel after refund failed", res.status, res.body);
  }
}
