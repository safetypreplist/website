import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import {
  paymentDescription,
  recordLicensePayment,
  retrieveCheckoutSessionForPayment,
  type CheckoutProduct,
} from "../_shared/payments.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`license-payments:${clientIp(req)}`, 30, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = normalizeLicenseKeyLoose(String(body.key || ""));
    if (!key.startsWith("SPL-")) return json({ error: "That license key is not valid." }, 403);

    const admin = serviceClient();
    const license = await findLicenseByKey(admin, key);
    if (!license || license.status !== "active") {
      return json({ error: "That license key is not valid." }, 403);
    }

    // Backfill from current Stripe session when history is empty or missing the latest session.
    if (license.stripe_session_id && !license.stripe_session_id.startsWith("legacy:")) {
      const existingLatest = await admin
        .from("license_payments")
        .select("id")
        .eq("license_id", license.id)
        .eq("stripe_session_id", license.stripe_session_id)
        .maybeSingle();
      if (!existingLatest.data) {
        const session = await retrieveCheckoutSessionForPayment(license.stripe_session_id);
        const productMeta = String(
          (session as { metadata?: Record<string, string> } | null)?.metadata?.product || "",
        );
        const checkoutProduct: CheckoutProduct =
          productMeta === "upgrade_to_pro"
            ? "upgrade_to_pro"
            : productMeta === "basic_additional"
              ? "basic_additional"
              : productMeta === "pro" || license.product === "pro"
                ? "pro"
                : "basic";
        // If this session looks like an upgrade, also seed a preserved Basic purchase line.
        // Prefer the license's original amount_cents; if an older upgrade overwrote it with $12.00, fall back to Basic list price.
        if (checkoutProduct === "upgrade_to_pro") {
          const initialCents =
            license.amount_cents != null && license.amount_cents !== 1200
              ? license.amount_cents
              : 1299;
          await recordLicensePayment(admin, {
            licenseId: license.id,
            stripeSessionId: `legacy:${license.id}:initial`,
            checkoutProduct: "basic",
            amountCents: initialCents,
            paidAt: license.created_at,
          });
        }
        await recordLicensePayment(admin, {
          licenseId: license.id,
          stripeSessionId: license.stripe_session_id,
          checkoutProduct:
            checkoutProduct === "pro" && license.product === "pro" && license.amount_cents != null
              ? "pro"
              : checkoutProduct,
          amountCents:
            typeof session?.amount_total === "number"
              ? session.amount_total
              : license.amount_cents || 0,
          session,
        });
      }
    }

    // If still empty, seed from license first-purchase fields.
    const { count } = await admin
      .from("license_payments")
      .select("id", { count: "exact", head: true })
      .eq("license_id", license.id);
    if ((count || 0) === 0 && license.amount_cents != null) {
      await recordLicensePayment(admin, {
        licenseId: license.id,
        stripeSessionId: license.stripe_session_id || `legacy:${license.id}:initial`,
        checkoutProduct: license.product === "pro" ? "pro" : "basic",
        amountCents: license.amount_cents,
        paidAt: license.created_at,
      });
    }

    const { data, error } = await admin
      .from("license_payments")
      .select(
        "id, stripe_session_id, payment_intent_id, checkout_product, description, amount_cents, tax_cents, currency, payment_method_summary, receipt_url, paid_at",
      )
      .eq("license_id", license.id)
      .order("paid_at", { ascending: true });
    if (error) {
      console.error(error);
      return json({ error: "Could not load purchase history." }, 500);
    }

    return json({
      ok: true,
      payments: (data || []).map((row) => ({
        id: row.id,
        stripeSessionId: row.stripe_session_id,
        paymentIntentId: row.payment_intent_id,
        checkoutProduct: row.checkout_product,
        description: row.description || paymentDescription(row.checkout_product as CheckoutProduct),
        amountCents: row.amount_cents,
        taxCents: row.tax_cents,
        currency: row.currency || "usd",
        paymentMethodSummary: row.payment_method_summary,
        receiptUrl: row.receipt_url,
        paidAt: row.paid_at,
      })),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not load purchase history." }, 500);
  }
});
