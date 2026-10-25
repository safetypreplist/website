import { json, preflight } from "../_shared/http.ts";
import { cancelRemoteSubscription } from "../_shared/cancelRemote.ts";
import { syncSubscription, type SubscriptionRow } from "../_shared/subscriptions.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user } = await requireUser(req);
    if (!user) return json({ error: "Sign in required" }, 401);

    const admin = serviceClient();
    const { data } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "suspended"]);
    const rows = (data || []) as SubscriptionRow[];
    if (!rows.length) return json({ error: "No active subscription to cancel." }, 400);

    for (const row of rows) {
      const res = await cancelRemoteSubscription(row, "Cancelled by the customer in Account Settings");
      if (!res.ok) {
        console.error("Subscription cancel failed", res.processor, res.status, res.body);
        return json({ error: "We could not cancel the subscription. Try again or contact us." }, 502);
      }
      await syncSubscription(admin, row);
    }

    const profile = await admin.from("profiles").select("access_ends_at").eq("id", user.id).maybeSingle();
    return json({ ok: true, accessEndsAt: (profile.data as { access_ends_at: string | null } | null)?.access_ends_at ?? null });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not cancel the subscription" }, 500);
  }
});
