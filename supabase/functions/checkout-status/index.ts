import { json, preflight } from "../_shared/http.ts";
import { fulfillCheckoutSession, retrieveCheckoutSession } from "../_shared/fulfill.ts";
import { serviceClient } from "../_shared/supabase.ts";
import type { LicenseRow } from "../_shared/licenses.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || body.session_id || "");
    if (!sessionId.startsWith("cs_")) return json({ error: "Missing checkout session" }, 400);

    const admin = serviceClient();
    const existing = await admin.from("licenses").select("*").eq("stripe_session_id", sessionId).maybeSingle();
    if (existing.data) {
      const row = existing.data as LicenseRow;
      const payment = await admin
        .from("license_payments")
        .select("checkout_product")
        .eq("stripe_session_id", sessionId)
        .eq("license_id", row.id)
        .maybeSingle();
      const fromPayment = payment.data?.checkout_product;
      const checkoutProduct =
        fromPayment === "upgrade_to_pro" ||
        fromPayment === "basic_additional" ||
        fromPayment === "basic" ||
        fromPayment === "pro"
          ? fromPayment
          : row.linked_to
            ? "basic_additional"
            : row.product;
      return json({
        alreadyProcessed: true,
        licenseKey: row.license_key,
        product: row.product,
        checkoutProduct,
        licenseId: row.id,
        email: row.email,
      });
    }

    const session = await retrieveCheckoutSession(sessionId);
    if (!session) return json({ error: "Payment could not be verified" }, 402);
    const result = await fulfillCheckoutSession(admin, session);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({
      alreadyProcessed: result.alreadyProcessed,
      licenseKey: result.licenseKey,
      product: result.product,
      checkoutProduct: result.checkoutProduct,
      licenseId: result.licenseId,
      email: result.email,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Verification failed" }, 500);
  }
});
