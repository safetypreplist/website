import { getDeviceId, getLicense } from "./licenseClient";
import { invokeFunction } from "./supabase";

export type GroupPermission = "view" | "edit";
export type GroupInviteStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";

export type GroupPricingRow = {
  devices: number;
  durationDays: number;
  cents: number;
  lookup: string;
};

export type GroupMember = {
  id: string;
  role: "host" | "member";
  permission: GroupPermission;
  permissionAccepted: boolean;
  inviteStatus: GroupInviteStatus;
  displayName: string;
  invitedEmail: string | null;
  invitedLicenseKey: string | null;
  licenseProduct: string | null;
  licenseId: string | null;
  inviteSentAt: string | null;
  respondedAt: string | null;
};

export type GroupSession = {
  id: string;
  name: string | null;
  status: "pending_setup" | "active" | "ended" | "expired";
  maxDevices: number;
  durationDays: number;
  expiresAt: string | null;
  remainingMs: number | null;
  hostLicenseId: string;
  isHost: boolean;
  memberCount: number;
  otherActiveMembers: number;
  members: GroupMember[];
};

export const GROUP_SHARING_PRICES: GroupPricingRow[] = [
  { devices: 2, durationDays: 7, cents: 599, lookup: "spl_group_2_7d" },
  { devices: 2, durationDays: 14, cents: 999, lookup: "spl_group_2_14d" },
  { devices: 2, durationDays: 30, cents: 1499, lookup: "spl_group_2_30d" },
  { devices: 3, durationDays: 7, cents: 799, lookup: "spl_group_3_7d" },
  { devices: 3, durationDays: 14, cents: 1299, lookup: "spl_group_3_14d" },
  { devices: 3, durationDays: 30, cents: 1799, lookup: "spl_group_3_30d" },
  { devices: 4, durationDays: 7, cents: 999, lookup: "spl_group_4_7d" },
  { devices: 4, durationDays: 14, cents: 1499, lookup: "spl_group_4_14d" },
  { devices: 4, durationDays: 30, cents: 1999, lookup: "spl_group_4_30d" },
];

function authBody(extra: Record<string, unknown> = {}) {
  const license = getLicense();
  if (!license?.key) throw new Error("Activate a license to use Group Sharing.");
  return {
    licenseKey: license.key,
    deviceId: getDeviceId(),
    origin: typeof window !== "undefined" ? window.location.origin : undefined,
    ...extra,
  };
}

export async function fetchGroupStatus() {
  return invokeFunction<{ group: GroupSession | null; pricing?: GroupPricingRow[] }>("group-sharing", authBody({ action: "status" }));
}

export async function startGroupCheckout(devices: number, durationDays: number, renewGroupId?: string) {
  return invokeFunction<{ url?: string }>("create-checkout-session", {
    ...authBody({
      product: "group_sharing",
      groupDevices: devices,
      groupDurationDays: durationDays,
      ...(renewGroupId ? { renewGroupId } : {}),
    }),
  });
}

export async function setupGroup(groupId: string, name: string) {
  return invokeFunction<{ group: GroupSession | null }>("group-sharing", authBody({ action: "setup", groupId, name }));
}

export async function inviteToGroup(opts: {
  groupId: string;
  email?: string;
  inviteLicenseKey?: string;
  permission: GroupPermission;
  displayName?: string;
}) {
  return invokeFunction<{ group: GroupSession | null; emailSent?: boolean; emailError?: string }>(
    "group-sharing",
    authBody({ action: "invite", ...opts }),
  );
}

export async function resendInvite(groupId: string, memberId: string) {
  return invokeFunction<{ group: GroupSession | null; emailSent?: boolean }>(
    "group-sharing",
    authBody({ action: "resend", groupId, memberId }),
  );
}

export async function revokeMember(groupId: string, memberId: string) {
  return invokeFunction<{ group: GroupSession | null }>("group-sharing", authBody({ action: "revoke", groupId, memberId }));
}

export async function setMemberPermission(groupId: string, memberId: string, permission: GroupPermission) {
  return invokeFunction<{ group: GroupSession | null }>(
    "group-sharing",
    authBody({ action: "set_permission", groupId, memberId, permission }),
  );
}

export async function acceptPermissionChange(groupId: string) {
  return invokeFunction<{ group: GroupSession | null }>("group-sharing", authBody({ action: "accept_permission", groupId }));
}

export async function endGroup(groupId: string) {
  return invokeFunction<{ ended?: boolean }>("group-sharing", authBody({ action: "end", groupId }));
}

export async function leaveGroup(groupId: string) {
  return invokeFunction<{ left?: boolean }>("group-sharing", authBody({ action: "leave", groupId }));
}

export async function previewInvite(token: string) {
  return invokeFunction<{
    inviteStatus: GroupInviteStatus;
    groupName?: string;
    hostName?: string;
    permission?: GroupPermission;
    expiresAt?: string | null;
    requiresDevice?: boolean;
  }>("group-sharing", { action: "invite_preview", token });
}

export async function respondToInvite(token: string, accept: boolean) {
  return invokeFunction<{ inviteStatus: GroupInviteStatus; group?: GroupSession | null; code?: string }>(
    "group-sharing",
    authBody({ action: accept ? "accept" : "decline", token }),
  );
}

export async function pullSharedChecklist(groupId: string, ownerLicenseId: string) {
  return invokeFunction<{
    ownerLicenseId: string;
    ownerName: string;
    permission: "own" | GroupPermission;
    canEdit: boolean;
    items: Array<{ checklist_item_id: string; checked: boolean; note: string; updated_at: string }>;
    customItems: Array<{
      id: string;
      section_id: string;
      text: string;
      description: string | null;
      sort_order: number;
      checked: boolean;
      note: string;
      updated_at: string;
    }>;
  }>("group-sharing", authBody({ action: "pull", groupId, ownerLicenseId }));
}

export async function pushSharedChecklist(
  groupId: string,
  ownerLicenseId: string,
  items: Array<{ checklistItemId: string; checked: boolean; note: string }>,
) {
  return invokeFunction<{ ok?: boolean }>("group-sharing", authBody({ action: "push", groupId, ownerLicenseId, items }));
}

export function formatRemaining(ms: number | null | undefined) {
  if (ms == null) return "Not started";
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 2) return `${days} days left`;
  if (days === 1) return `${hours} hours left`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} min left`;
}

export function priceFor(devices: number, durationDays: number) {
  return GROUP_SHARING_PRICES.find((row) => row.devices === devices && row.durationDays === durationDays) || null;
}
