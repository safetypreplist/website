import { json, preflight } from "../_shared/http.ts";
import { activateSubscription } from "../_shared/activation.ts";
import type { SubscriptionRow } from "../_shared/subscriptions.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const subscriptionId = String(body.subscriptionId || "");
    if (!subscriptionId) return json({ error: "Missing subscriptionId" }, 400);

    const admin = serviceClient();
    const found = await admin
      .from("subscriptions")
      .select("*")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();
    const row = found.data as SubscriptionRow | null;
    if (!row) return json({ error: "Unknown subscription" }, 404);

    const result = await activateSubscription(admin, row, { waitForActive: true });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({
      ...(result.alreadyProcessed ? { alreadyProcessed: true } : {}),
      productCode: result.productCode,
      productType: result.productType,
      purchaseId: result.purchaseId,
      linkedToUser: result.linkedToUser,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Verification failed" }, 500);
  }
});
