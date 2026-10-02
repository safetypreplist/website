import { serviceClient } from "./supabase.ts";

export type PlanKind = "individual" | "family";
export type DiscountKind = "percent" | "fixed";
export type AppliesTo = "all" | "individual" | "family";

export type DiscountRow = {
  code: string;
  kind: DiscountKind;
  value: number;
  applies_to: AppliesTo;
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
};

export function normalizeCode(raw: unknown) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
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

export function discountCentsForPlan(row: DiscountRow, planKind: PlanKind, subscriptionCents: number) {
  if (row.applies_to !== "all" && row.applies_to !== planKind) return 0;
  if (subscriptionCents <= 0) return 0;
  if (row.kind === "percent") {
    const percent = Math.min(100, Math.max(1, row.value));
    return Math.min(subscriptionCents, Math.round((subscriptionCents * percent) / 100));
  }
  return Math.min(subscriptionCents, Math.max(0, Math.round(row.value)));
}

export async function loadDiscount(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const admin = serviceClient();
  const { data, error } = await admin
    .from("discount_codes")
    .select("code, kind, value, applies_to, active, expires_at, max_redemptions, redemption_count")
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
}) {
  const discountCents = args.row ? discountCentsForPlan(args.row, args.planKind, args.subscriptionCents) : 0;
  const dueTodayCents = Math.max(0, args.subscriptionCents - discountCents) + args.vaultCents;
  return { discountCents, dueTodayCents };
}

export async function incrementDiscountRedemption(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  const admin = serviceClient();
  const { error } = await admin.rpc("increment_discount_redemption", { p_code: normalized });
  if (error) console.error(error);
}
