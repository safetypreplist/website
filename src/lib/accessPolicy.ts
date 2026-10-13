import { trustedNow } from "./offlineStore";

export const READ_ONLY_DAYS = 3;

export type AccessMode = "full" | "readonly" | "locked";

/**
 * Full use until the paid-through date, then read-only for 3 days, then locked.
 * Nothing is deleted in any mode. The server applies the same rule on every sync.
 */
export function accessMode(endsAt?: string | null, serverTime?: string | null): AccessMode {
  if (!endsAt) return "full";
  const ends = Date.parse(endsAt);
  if (!Number.isFinite(ends)) return "full";
  const now = trustedNow(serverTime);
  if (now < ends) return "full";
  if (now < ends + READ_ONLY_DAYS * 86400000) return "readonly";
  return "locked";
}

export function readOnlyUntil(endsAt?: string | null) {
  if (!endsAt) return null;
  return new Date(Date.parse(endsAt) + READ_ONLY_DAYS * 86400000).toISOString();
}
