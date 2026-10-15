import { json } from "./http.ts";
import { requireUser, serviceClient } from "./supabase.ts";

export const COMING_SOON_BLOCK_MESSAGE =
  "Safety Prep List isn't taking new purchases right now. Please check back soon!";

// While Maintenance Mode is on, only the owner and existing paying customers may start a purchase.
// Existing customers still need to renew, add checklists, or add the Survival Vault.
export function comingSoonAllows(input: { enabled: boolean; isOwner: boolean; isCustomer: boolean }) {
  if (!input.enabled) return true;
  return input.isOwner || input.isCustomer;
}

/**
 * Returns a 403 response when the caller may not start a purchase, or null to continue.
 * If the setting can't be read, checkout continues: a fault here must never stop real customers from paying.
 * Finishing a purchase that was already paid for (activate, capture, webhook) is never blocked.
 */
export async function comingSoonBlock(req: Request): Promise<Response | null> {
  try {
    const admin = serviceClient();
    const { data, error } = await admin.from("app_config").select("value").eq("key", "coming_soon").maybeSingle();
    if (error) {
      console.error("Maintenance Mode setting unreadable", error);
      return null;
    }
    const enabled = (data?.value as { enabled?: unknown } | null)?.enabled === true;
    if (!enabled) return null;

    let isOwner = false;
    let isCustomer = false;
    const { user } = await requireUser(req);
    if (user) {
      const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      isOwner = profile?.role === "owner";
      if (!isOwner) {
        const { data: paid } = await admin
          .from("purchases")
          .select("id")
          .eq("user_id", user.id)
          .eq("payment_status", "completed")
          .limit(1);
        isCustomer = Boolean(paid?.length);
      }
    }
    return comingSoonAllows({ enabled, isOwner, isCustomer }) ? null : json({ error: COMING_SOON_BLOCK_MESSAGE }, 403);
  } catch (err) {
    console.error("Maintenance Mode check failed", err);
    return null;
  }
}
