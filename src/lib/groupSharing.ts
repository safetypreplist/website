import { getDeviceId, getLicense } from "./licenseClient";
import { loadLocalProfile } from "./localProfile";
import { invokeFunction } from "./supabase";

export type GroupPermission = "view" | "edit";
export type GroupInviteStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";
export type InviteEmailStatus = "sent" | "failed" | "not_sent";

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
  isYou?: boolean;
  invitedEmail: string | null;
  invitedLicenseKey: string | null;
  licenseProduct: string | null;
  licenseId: string | null;
  inviteSentAt: string | null;
  respondedAt: string | null;
  emailStatus?: InviteEmailStatus | null;
};

export type GroupSeats = { used: number; accepted: number; pending: number; max: number; full: boolean };

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
  seats?: GroupSeats;
  me?: {
    memberId: string;
    licenseId: string;
    role: "host" | "member";
    permission: GroupPermission;
    permissionAccepted: boolean;
  } | null;
  members: GroupMember[];
};

export type PendingGroupInvite = {
  id: string;
  groupId: string;
  groupName: string;
  hostName: string;
  permission: GroupPermission;
  expiresAt: string | null;
  invitedAt: string | null;
};

export type RenewableGroup = {
  id: string;
  name: string | null;
  maxDevices: number;
  durationDays: number;
  expiredAt: string | null;
};

export type GroupStatusResponse = {
  group: GroupSession | null;
  pendingInvites?: PendingGroupInvite[];
  renewable?: RenewableGroup | null;
  pricing?: GroupPricingRow[];
};

export type InviteResponse = {
  group: GroupSession | null;
  emailSent?: boolean;
  emailStatus?: InviteEmailStatus;
  emailError?: string | null;
  inviteUrl?: string;
  inviteeLicensed?: boolean | null;
  memberId?: string;
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

function myName() {
  try {
    return loadLocalProfile().displayName.trim().slice(0, 80) || undefined;
  } catch {
    return undefined;
  }
}

function authBody(extra: Record<string, unknown> = {}) {
  const license = getLicense();
  if (!license?.key) throw new Error("Activate a license to use Group Sharing.");
  return {
    licenseKey: license.key,
    deviceId: getDeviceId(),
    origin: typeof window !== "undefined" ? window.location.origin : undefined,
    myName: myName(),
    ...extra,
  };
}

const STATUS_MAX_AGE_MS = 20_000;
let statusCache: { key: string; at: number; data: GroupStatusResponse } | null = null;
let statusInFlight: { key: string; promise: Promise<GroupStatusResponse> } | null = null;
const statusListeners = new Set<(data: GroupStatusResponse) => void>();

/** Every app route shows the Group Sharing badge, so share one recent status answer between them. */
export function fetchGroupStatus(options?: { fresh?: boolean }): Promise<GroupStatusResponse> {
  const key = getLicense()?.key || "";
  if (!options?.fresh && statusCache && statusCache.key === key && Date.now() - statusCache.at < STATUS_MAX_AGE_MS) {
    return Promise.resolve(statusCache.data);
  }
  if (statusInFlight && statusInFlight.key === key) return statusInFlight.promise;
  const promise = invokeFunction<GroupStatusResponse>("group-sharing", authBody({ action: "status" }))
    .then((data) => {
      rememberGroupStatus(data);
      return data;
    })
    .finally(() => {
      statusInFlight = null;
    });
  statusInFlight = { key, promise };
  return promise;
}

function rememberGroupStatus(data: GroupStatusResponse) {
  statusCache = { key: getLicense()?.key || "", at: Date.now(), data };
  for (const listener of statusListeners) listener(data);
}

/** After a change, update the shared status so the badge and Home banner follow right away. */
function updateCachedGroup(group: GroupSession | null, patch?: Partial<GroupStatusResponse>) {
  const prev = statusCache?.data || { group: null };
  rememberGroupStatus({ ...prev, group, ...patch });
}

export function forgetGroupStatus() {
  statusCache = null;
}

export function onGroupStatus(listener: (data: GroupStatusResponse) => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

async function withGroup<T extends { group?: GroupSession | null }>(request: Promise<T>) {
  const data = await request;
  if ("group" in data) updateCachedGroup(data.group ?? null);
  return data;
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
  return withGroup(
    invokeFunction<{ group: GroupSession | null }>("group-sharing", authBody({ action: "setup", groupId, name })),
  );
}

export async function inviteToGroup(opts: {
  groupId: string;
  email?: string;
  inviteLicenseKey?: string;
  permission: GroupPermission;
  displayName?: string;
}) {
  return withGroup(invokeFunction<InviteResponse>("group-sharing", authBody({ action: "invite", ...opts })));
}

export async function resendInvite(groupId: string, memberId: string) {
  return withGroup(
    invokeFunction<InviteResponse>("group-sharing", authBody({ action: "resend", groupId, memberId })),
  );
}

export async function fetchInviteLink(groupId: string, memberId: string) {
  return invokeFunction<{ inviteUrl: string }>("group-sharing", authBody({ action: "invite_link", groupId, memberId }));
}

export async function revokeMember(groupId: string, memberId: string) {
  return withGroup(
    invokeFunction<{ group: GroupSession | null }>("group-sharing", authBody({ action: "revoke", groupId, memberId })),
  );
}

export async function setMemberPermission(groupId: string, memberId: string, permission: GroupPermission) {
  return withGroup(
    invokeFunction<{ group: GroupSession | null }>(
      "group-sharing",
      authBody({ action: "set_permission", groupId, memberId, permission }),
    ),
  );
}

export async function acceptPermissionChange(groupId: string) {
  return withGroup(
    invokeFunction<{ group: GroupSession | null }>("group-sharing", authBody({ action: "accept_permission", groupId })),
  );
}

export async function endGroup(groupId: string) {
  const data = await invokeFunction<{ ended?: boolean }>("group-sharing", authBody({ action: "end", groupId }));
  forgetGroupStatus();
  return data;
}

export async function leaveGroup(groupId: string) {
  const data = await invokeFunction<{ left?: boolean }>("group-sharing", authBody({ action: "leave", groupId }));
  forgetGroupStatus();
  return data;
}

export async function previewInvite(token: string) {
  return invokeFunction<{
    inviteStatus: GroupInviteStatus;
    groupName?: string;
    hostName?: string;
    permission?: GroupPermission;
    expiresAt?: string | null;
    groupStatus?: GroupSession["status"];
    requiresDevice?: boolean;
  }>("group-sharing", { action: "invite_preview", token });
}

export async function respondToInvite(token: string, accept: boolean) {
  const data = await invokeFunction<{ inviteStatus: GroupInviteStatus; group?: GroupSession | null; code?: string }>(
    "group-sharing",
    authBody({ action: accept ? "accept" : "decline", token }),
  );
  forgetGroupStatus();
  return data;
}

/** Answer an invite shown inside the app (matched to this verified license on the server). */
export async function respondToInviteInApp(memberId: string, accept: boolean) {
  const data = await invokeFunction<{ inviteStatus: GroupInviteStatus; group?: GroupSession | null }>(
    "group-sharing",
    authBody({ action: accept ? "accept_invite" : "decline_invite", memberId }),
  );
  forgetGroupStatus();
  return data;
}

export type SharedChecklist = {
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
};

export async function pullSharedChecklist(groupId: string, ownerLicenseId: string) {
  return invokeFunction<SharedChecklist>("group-sharing", authBody({ action: "pull", groupId, ownerLicenseId }));
}

export async function pushSharedChecklist(
  groupId: string,
  ownerLicenseId: string,
  items: Array<{ checklistItemId: string; checked: boolean; note: string }>,
  customItems?: Array<{ id: string; sectionId: string; text: string; description: string | null; sortOrder: number }>,
) {
  return invokeFunction<{ ok?: boolean }>(
    "group-sharing",
    authBody({ action: "push", groupId, ownerLicenseId, items, ...(customItems ? { customItems } : {}) }),
  );
}

/** Seats = host + accepted members + invites still waiting (falls back for older servers). */
export function seatsFor(group: GroupSession): GroupSeats {
  if (group.seats) return group.seats;
  const accepted = group.members.filter((m) => m.inviteStatus === "accepted").length;
  const pending = group.members.filter((m) => m.inviteStatus === "pending").length;
  const used = accepted + pending;
  return { used, accepted, pending, max: group.maxDevices, full: used >= group.maxDevices };
}

export function formatRemaining(ms: number | null | undefined) {
  if (ms == null) return "Not started";
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) {
    const days = Math.round(ms / 86_400_000);
    return `${days} days left`;
  }
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} min left`;
}

export function priceFor(devices: number, durationDays: number) {
  return GROUP_SHARING_PRICES.find((row) => row.devices === devices && row.durationDays === durationDays) || null;
}
