import { stripeRequest } from "./stripe.ts";
import { serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

export type CheckoutProduct = "basic" | "pro" | "basic_additional" | "upgrade_to_pro";

export type StripeSessionPayment = {
  id: string;
  amount_total?: number | null;
  currency?: string | null;
  created?: number | null;
  payment_intent?:
    | string
    | {
        id?: string;
        latest_charge?:
          | string
          | {
              id?: string;
              receipt_url?: string | null;
              payment_method_details?: {
                card?: { brand?: string; last4?: string };
                type?: string;
              } | null;
            }
          | null;
      }
    | null;
  total_details?: { amount_tax?: number | null } | null;
};

export function paymentDescription(product: CheckoutProduct) {
  if (product === "pro") return "Pro Plan Purchased";
  if (product === "upgrade_to_pro") return "Upgraded to Pro";
  if (product === "basic_additional") return "Additional Device Purchased";
  return "Basic Plan Purchased";
}

function paymentMethodSummary(session: StripeSessionPayment) {
  const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const card = charge?.payment_method_details?.card;
  if (card?.brand && card?.last4) {
    return `${card.brand.toUpperCase()} •••• ${card.last4}`;
  }
  const type = charge?.payment_method_details?.type;
  return type || null;
}

function receiptUrl(session: StripeSessionPayment) {
  const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  return charge?.receipt_url || null;
}

function paymentIntentId(session: StripeSessionPayment) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id || null;
}

export async function retrieveCheckoutSessionForPayment(sessionId: string) {
  const res = await stripeRequest<StripeSessionPayment>(
    "GET",
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      expand: ["payment_intent.latest_charge"],
    },
  );
  if (!res.ok) return null;
  return res.body;
}

export async function recordLicensePayment(
  admin: Admin,
  opts: {
    licenseId: string;
    stripeSessionId: string;
    checkoutProduct: CheckoutProduct;
    amountCents: number;
    currency?: string | null;
    paidAt?: string | null;
    session?: StripeSessionPayment | null;
  },
) {
  const session =
    opts.session ||
    (opts.stripeSessionId.startsWith("legacy:")
      ? null
      : await retrieveCheckoutSessionForPayment(opts.stripeSessionId));
  const amountCents =
    typeof session?.amount_total === "number" ? session.amount_total : opts.amountCents;
  const taxCents =
    typeof session?.total_details?.amount_tax === "number" ? session.total_details.amount_tax : null;
  const paidAt =
    opts.paidAt ||
    (typeof session?.created === "number" ? new Date(session.created * 1000).toISOString() : new Date().toISOString());

  const row = {
    license_id: opts.licenseId,
    stripe_session_id: opts.stripeSessionId,
    payment_intent_id: session ? paymentIntentId(session) : null,
    checkout_product: opts.checkoutProduct,
    description: paymentDescription(opts.checkoutProduct),
    amount_cents: amountCents,
    tax_cents: taxCents,
    currency: (session?.currency || opts.currency || "usd").toLowerCase(),
    payment_method_summary: session ? paymentMethodSummary(session) : null,
    receipt_url: session ? receiptUrl(session) : null,
    paid_at: paidAt,
  };

  const inserted = await admin
    .from("license_payments")
    .upsert(row, { onConflict: "license_id,stripe_session_id" })
    .select("*")
    .maybeSingle();
  if (inserted.error) {
    console.error(inserted.error);
    return null;
  }
  return inserted.data;
}
