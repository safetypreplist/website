import { canEditChecklist, canRenewGroup, inviteMatchesLicense, renewedExpiry, seatSummary } from "./groupRules.ts";

function check(name: string, actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
  console.log(`ok  ${name}`);
}

const DAY = 86_400_000;
const now = Date.parse("2026-11-26T12:00:00Z");
const status = (s: "pending" | "accepted" | "declined" | "expired" | "revoked") => ({ invite_status: s });

// Seats: host + accepted + pending, never declined/revoked/expired.
check("host alone uses 1 seat", seatSummary([status("accepted")], 2).used, 1);
check("pending invite takes a seat", seatSummary([status("accepted"), status("pending")], 2).full, true);
check(
  "declined, revoked and expired free their seats",
  seatSummary([status("accepted"), status("declined"), status("revoked"), status("expired")], 2).used,
  1,
);
check("3 of 4 is not full", seatSummary([status("accepted"), status("accepted"), status("pending")], 4).full, false);

// Invite matching: key invites bind to the key; email invites to the license email (case-insensitive).
const license = { id: "lic-1", license_key: "SPL-AAAA-BBBB", email: "Guest@Example.com" };
const invite = {
  license_id: null,
  role: "member" as const,
  permission: "view" as const,
  permission_accepted: false,
  invite_status: "pending" as const,
  invited_email: "guest@example.com",
  invited_license_key: null,
};
check("email invite matches license email", inviteMatchesLicense(invite, license), true);
check("email invite does not match another email", inviteMatchesLicense(invite, { ...license, email: "x@example.com" }), false);
check("email invite does not match a license without email", inviteMatchesLicense(invite, { ...license, email: null }), false);
check(
  "key invite matches only that key",
  inviteMatchesLicense({ ...invite, invited_license_key: "spl-aaaa-bbbb" }, license),
  true,
);
check(
  "key invite ignores a matching email on a different key",
  inviteMatchesLicense({ ...invite, invited_license_key: "SPL-ZZZZ-ZZZZ" }, license),
  false,
);
check("answered invites never match", inviteMatchesLicense({ ...invite, invite_status: "accepted" }, license), false);
check("host rows never match", inviteMatchesLicense({ ...invite, role: "host" }, license), false);

// Edit rights come from the viewer, not the checklist owner.
const viewer = { license_id: "lic-guest", permission: "view" as const, permission_accepted: false, invite_status: "accepted" as const };
check("view-only member cannot edit someone else", canEditChecklist(viewer, "lic-host"), false);
check("view-only member can edit their own list", canEditChecklist(viewer, "lic-guest"), true);
check("edit not yet approved cannot edit", canEditChecklist({ ...viewer, permission: "edit" }, "lic-host"), false);
check(
  "approved edit member can edit others",
  canEditChecklist({ ...viewer, permission: "edit", permission_accepted: true }, "lic-host"),
  true,
);
check(
  "left/revoked member cannot edit",
  canEditChecklist({ ...viewer, permission: "edit", permission_accepted: true, invite_status: "revoked" }, "lic-host"),
  false,
);

// Renewal: extend from the current end while active, restart from now once expired.
check(
  "active group adds days to its end date",
  renewedExpiry(new Date(now + 2 * DAY).toISOString(), 7, now),
  new Date(now + 9 * DAY).toISOString(),
);
check(
  "expired group restarts from now",
  renewedExpiry(new Date(now - 3 * DAY).toISOString(), 14, now),
  new Date(now + 14 * DAY).toISOString(),
);
check("active group can renew", canRenewGroup({ status: "active", expires_at: null, ended_at: null }, now), true);
check(
  "recently expired group can renew",
  canRenewGroup({ status: "expired", expires_at: new Date(now - 5 * DAY).toISOString(), ended_at: null }, now),
  true,
);
check(
  "long-expired group cannot renew",
  canRenewGroup({ status: "expired", expires_at: null, ended_at: new Date(now - 31 * DAY).toISOString() }, now),
  false,
);
check("ended group cannot renew", canRenewGroup({ status: "ended", expires_at: null, ended_at: null }, now), false);
check("unfinished setup cannot renew", canRenewGroup({ status: "pending_setup", expires_at: null, ended_at: null }, now), false);
