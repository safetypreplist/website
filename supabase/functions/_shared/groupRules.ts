// Pure Group Sharing rules shared by the edge functions (no Deno or database access).

export const RENEW_GRACE_DAYS = 30;
const DAY_MS = 86_400_000;

type MemberLike = {
  license_id: string | null;
  role: "host" | "member";
  permission: "view" | "edit";
  permission_accepted: boolean;
  invite_status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  invited_email: string | null;
  invited_license_key: string | null;
};

type LicenseLike = { id: string; license_key: string; email: string | null };

/** Seats are the host plus every accepted member plus every invite still waiting for an answer. */
export function seatSummary(members: Pick<MemberLike, "invite_status">[], maxDevices: number) {
  const accepted = members.filter((m) => m.invite_status === "accepted").length;
  const pending = members.filter((m) => m.invite_status === "pending").length;
  const used = accepted + pending;
  return { used, accepted, pending, max: maxDevices, full: used >= maxDevices };
}

export function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

/** A pending invite belongs to a license when it named that key, or (for email invites) that purchase email. */
export function inviteMatchesLicense(member: MemberLike, license: LicenseLike) {
  if (member.invite_status !== "pending" || member.role !== "member") return false;
  if (member.license_id && member.license_id !== license.id) return false;
  if (member.invited_license_key) {
    return member.invited_license_key.trim().toUpperCase() === license.license_key.trim().toUpperCase();
  }
  const invited = normalizeEmail(member.invited_email);
  return Boolean(invited) && invited === normalizeEmail(license.email);
}

/** Edit rights come from the viewer's own membership; everyone can edit their own checklist. */
export function canEditChecklist(
  viewer: Pick<MemberLike, "license_id" | "permission" | "permission_accepted" | "invite_status">,
  ownerLicenseId: string,
) {
  if (viewer.invite_status !== "accepted") return false;
  if (viewer.license_id === ownerLicenseId) return true;
  return viewer.permission === "edit" && viewer.permission_accepted;
}

/** Renewal adds time to an unexpired group, or restarts the clock from now for an expired one. */
export function renewedExpiry(currentExpiresAt: string | null, durationDays: number, now = Date.now()) {
  const current = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(current) && current > now ? current : now;
  return new Date(base + durationDays * DAY_MS).toISOString();
}

export function canRenewGroup(
  group: { status: string; expires_at: string | null; ended_at: string | null },
  now = Date.now(),
) {
  if (group.status === "active") return true;
  if (group.status !== "expired") return false;
  const ended = Date.parse(group.ended_at || group.expires_at || "");
  return Number.isFinite(ended) && now - ended <= RENEW_GRACE_DAYS * DAY_MS;
}

export function displayNameFor(
  member: { display_name: string | null; role: "host" | "member"; invited_email?: string | null },
  licenseEmail: string | null | undefined,
) {
  const name = member.display_name?.trim();
  if (name) return name;
  const email = licenseEmail || member.invited_email || "";
  if (email) return email.split("@")[0];
  return member.role === "host" ? "Host" : "Member";
}
