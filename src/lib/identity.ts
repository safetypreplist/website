import type { Profile, ViewingContext } from "../types";
import { FAMILY_MIN_SEATS, MONTHLY_CENTS, checkoutBreakdown, type AccessInterval } from "./pricing";

export {
  ACCESS_ANNUAL_CENTS,
  ACCESS_MONTHLY_CENTS,
  ANNUAL_CENTS,
  FAMILY_MIN_SEATS,
  MONTHLY_CENTS,
  SURVIVAL_VAULT_CENTS,
  SURVIVAL_VAULT_NAME,
} from "./pricing";

export const MAX_DEVICES = 2;

export function firstNameOf(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "";
}

export function personName(profile?: Pick<Profile, "display_name" | "first_name" | "last_name" | "full_name" | "email"> | null) {
  if (!profile) return "My";
  const display = profile.display_name?.trim();
  if (display) return display;
  const first = profile.first_name?.trim();
  const last = profile.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  if (profile.full_name?.trim()) return profile.full_name.trim();
  const local = profile.email?.split("@")[0]?.trim();
  return local || "My";
}

export function checklistTitle(name?: string | null) {
  const n = (name || "My").trim() || "My";
  return /s$/i.test(n) ? `${n}' Checklist` : `${n}'s Checklist`;
}

export function possessiveName(name?: string | null) {
  return checklistTitle(name);
}

export function permissionLabel(permission?: ViewingContext["permission"] | "view" | "edit" | "own") {
  if (permission === "edit" || permission === "own") return "Can Edit";
  return "View Only";
}

export function planTypeLabel(args: { plan?: string | null; familySize?: number }) {
  if (!args.plan || args.plan === "none") return "None";
  if ((args.familySize ?? 1) >= 2) return "Family Plan";
  return "Individual Plan";
}

export function familyPriceCents(people: number) {
  const seats = Math.max(FAMILY_MIN_SEATS, Math.floor(people) || FAMILY_MIN_SEATS);
  return seats * MONTHLY_CENTS;
}

export function checkoutTotalCents(people: number, includeVault: boolean, access: AccessInterval = "monthly") {
  return checkoutBreakdown(people, access, includeVault).dueTodayCents;
}

export function generatePublicChecklistId() {
  const n = Math.floor(Math.random() * 1_000_000);
  return `SPL-${String(n).padStart(6, "0")}`;
}

export function initialsFrom(name?: string | null, email?: string | null) {
  const text = name?.trim() || email?.trim() || "";
  if (!text) return "SP";
  const parts = text.split(/[\s@]+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  return letters.toUpperCase() || "SP";
}
