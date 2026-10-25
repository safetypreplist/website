import { serviceClient } from "./supabase.ts";

export type PlanKind = "individual" | "family";
export type DiscountKind = "percent" | "fixed" | "price";
export type AppliesTo = "all" | "individual" | "family";
export type AppliesToInterval = "all" | "monthly" | "annual";

export type DiscountRow = {
  code: string;
  kind: DiscountKind;
  value: number;
  applies_to: AppliesTo;
  applies_to_interval?: AppliesToInterval | null;
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  discount_payments: number;
};

export const LAUNCH_OFFER_CODE = "LAUNCH26";

export function normalizeCode(raw: unknown) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

/** LAUNCH26 is only valid from /launch26 checkout, not the main homepage. */
export function launchOfferAllowed(code: string, from: unknown) {
  if (normalizeCode(code) !== LAUNCH_OFFER_CODE) return true;
  return String(from || "").toLowerCase() === "launch26";
}

export function planKindFromQuantity(quantity: number, fallback?: unknown): PlanKind {
  if (quantity > 1) return "family";
  return fallback === "family" ? "family" : "individual";
}

export function isDiscountUsable(row: DiscountRow | null, now = new Date()) {
  if (!row?.active) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return false;
  if (row.max_redemptions != null && row.redemption_count >= row.max_redemptions) return false;
  return true;
}

export function discountCentsForPlan(
  row: DiscountRow,
  planKind: PlanKind,
  subscriptionCents: number,
  quantity = 1,
  interval?: "monthly" | "annual",
) {
  if (row.applies_to !== "all" && row.applies_to !== planKind) return 0;
  const billing = row.applies_to_interval || "all";
  if (billing !== "all" && billing !== interval) return 0;
  if (subscriptionCents <= 0) return 0;
  if (row.kind === "percent") {
    const percent = Math.min(100, Math.max(1, row.value));
    return Math.min(subscriptionCents, Math.round((subscriptionCents * percent) / 100));
  }
  if (row.kind === "price") {
    const setPriceCents = Math.max(0, Math.round(row.value)) * Math.max(1, quantity);
    return Math.max(0, subscriptionCents - setPriceCents);
  }
  return Math.min(subscriptionCents, Math.max(0, Math.round(row.value)));
}

export async function loadDiscount(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const admin = serviceClient();
  const { data, error } = await admin
    .from("discount_codes")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw error;
  return (data as DiscountRow | null) ?? null;
}

export function quoteWithDiscount(args: {
  row: DiscountRow | null;
  planKind: PlanKind;
  subscriptionCents: number;
  vaultCents: number;
  quantity: number;
  interval: "monthly" | "annual";
}) {
  const discountCents = args.row
    ? discountCentsForPlan(args.row, args.planKind, args.subscriptionCents, args.quantity, args.interval)
    : 0;
  const dueTodayCents = Math.max(0, args.subscriptionCents - discountCents) + args.vaultCents;
  return { discountCents, dueTodayCents };
}

export async function discountAlreadyUsedBy(code: string, userId?: string | null, email?: string | null) {
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  const admin = serviceClient();
  if (userId) {
    const byUser = await admin
      .from("subscriptions")
      .select("id")
      .eq("discount_code", normalized)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (byUser.data) return true;
    const purchase = await admin
      .from("purchases")
      .select("id")
      .eq("discount_code", normalized)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (purchase.data) return true;
  }
  if (email) {
    const purchase = await admin
      .from("purchases")
      .select("id")
      .eq("discount_code", normalized)
      .ilike("payer_email", email)
      .limit(1)
      .maybeSingle();
    if (purchase.data) return true;
  }
  return false;
}

export async function incrementDiscountRedemption(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  const admin = serviceClient();
  const { error } = await admin.rpc("increment_discount_redemption", { p_code: normalized });
  if (error) console.error(error);
}
