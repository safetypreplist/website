import type { Session, User } from "@supabase/supabase-js";
import catalog from "../data/catalog.json";
import { guessDeviceDescription } from "./device";
import { checklistTitle, personName } from "./identity";
import { isSupabaseConfigured } from "./supabase";
import type {
  ChecklistItem,
  ChecklistPermission,
  ChecklistSection,
  ChecklistSystem,
  ConnectedChecklist,
  Contact,
  CustomChecklistItem,
  Device,
  FamilyInvitation,
  PersonalChecklist,
  PlanGroup,
  Product,
  Profile,
  ProgressRow,
  SafetyContact,
  VideoResource,
  ViewingContext,
  ViewingKind,
} from "../types";
import { customItemCap, ITEM_LIMIT_ERROR } from "./customItems";

export const DEMO_EMAIL = "demo@demo.com";
export const DEMO_PASSWORD = "Abc123!";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_JIMMY_ID = "00000000-0000-4000-8000-000000000002";
export const DEMO_BOBBY_ID = "00000000-0000-4000-8000-000000000003";
export const DEMO_JASMINE_LIST = "00000000-0000-4000-8000-000000000101";
export const DEMO_JIMMY_LIST = "00000000-0000-4000-8000-000000000102";
export const DEMO_BOBBY_LIST = "00000000-0000-4000-8000-000000000103";
const SESSION_KEY = "spl.demo.signedIn";
const STATE_KEY = "spl.demo.state.v4";

export function isDemoMode() {
  return !isSupabaseConfigured();
}

type DemoMember = {
  checklist: PersonalChecklist;
  permission: ChecklistPermission | "own";
  progress: Record<string, ProgressRow>;
  customItems: CustomChecklistItem[];
};

type DemoState = {
  profile: Profile;
  group: PlanGroup;
  members: DemoMember[];
  householdProgress: Record<string, ProgressRow>;
  householdCustomItems: CustomChecklistItem[];
  invitations: FamilyInvitation[];
  contacts: Contact[];
  devices: Device[];
  currentDeviceId: string;
  activeView: { kind: ViewingKind; checklistId: string | null };
};

export function demoCatalog() {
  return {
    systems: catalog.systems as ChecklistSystem[],
    sections: catalog.sections as ChecklistSection[],
    items: catalog.items as ChecklistItem[],
    products: catalog.products as Product[],
    videos: catalog.videos as VideoResource[],
    safety: catalog.safety as SafetyContact[],
  };
}

function nowIso() {
  return new Date().toISOString();
}

function progressFromKeys(userId: string, keys: string[], deviceId: string, created: string) {
  const items = catalog.items as ChecklistItem[];
  const set = new Set(keys);
  const progress: Record<string, ProgressRow> = {};
  for (const item of items) {
    if (!set.has(item.permanent_key)) continue;
    progress[item.id] = {
      id: `prog-${userId}-${item.id}`,
      user_id: userId,
      checklist_item_id: item.id,
      checked: true,
      note: item.permanent_key === "grab.survival.flashlight" ? "Front zipper" : "",
      updated_by_device_id: deviceId,
      updated_at: created,
    };
  }
  return progress;
}

function memberChecklist(partial: Omit<PersonalChecklist, "displayName"> & { displayName?: string }): PersonalChecklist {
  const displayName =
    partial.displayName ||
    [partial.firstName, partial.lastName].filter(Boolean).join(" ") ||
    "Member";
  return { ...partial, displayName };
}

function defaultState(): DemoState {
  const created = nowIso();
  const currentId = "00000000-0000-4000-8000-000000000011";
  const otherId = "00000000-0000-4000-8000-000000000012";
  const jasmineKeys = [
    "grab.communication.phone",
    "grab.communication.powerbank",
    "grab.financial.wallet-id",
    "grab.financial.cards",
    "grab.financial.cash",
    "grab.access.keys",
    "grab.survival.flashlight",
    "ready.documents.passport",
    "ready.comms.noaa",
    "vehicle.safety.jumper-cables",
    "home.safety.smoke",
    "home.water.storage",
  ];
  const nanaKeys = [
    ...jasmineKeys,
    "grab.medical.meds",
    "ready.water.bottles",
    "ready.food.bars",
    "home.food.three-day",
    "home.power.flashlights",
  ];
  const jaxsonKeys = [
    "grab.communication.phone",
    "grab.financial.wallet-id",
    "grab.access.keys",
    "ready.documents.passport",
  ];
  const householdKeys = ["offgrid.tools.manual-can", "water.storage.jugs", "food.staples.rice"];

  const jasmine = memberChecklist({
    id: DEMO_JASMINE_LIST,
    publicId: "SPL-847291",
    ownerUserId: DEMO_USER_ID,
    purchasedByUserId: DEMO_USER_ID,
    status: "active",
    firstName: "Jasmine",
    lastName: "Carter",
    email: DEMO_EMAIL,
    displayName: "Jasmine",
    avatarUrl: null,
  });
  const nana = memberChecklist({
    id: DEMO_JIMMY_LIST,
    publicId: "SPL-493028",
    ownerUserId: DEMO_JIMMY_ID,
    purchasedByUserId: DEMO_USER_ID,
    status: "active",
    firstName: "Nana",
    lastName: "Carter",
    email: "nana@example.com",
    displayName: "Nana",
    avatarUrl: null,
  });
  const jaxson = memberChecklist({
    id: DEMO_BOBBY_LIST,
    publicId: "SPL-349285",
    ownerUserId: DEMO_BOBBY_ID,
    purchasedByUserId: DEMO_USER_ID,
    status: "active",
    firstName: "Jaxson",
    lastName: "Carter",
    email: "jaxson@example.com",
    displayName: "Jaxson",
    avatarUrl: null,
  });

  return {
    profile: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      full_name: "Jasmine Carter",
      first_name: "Jasmine",
      last_name: "Carter",
      display_name: "Jasmine",
      phone: null,
      avatar_url: null,
      plan: "full",
      access_interval: null,
      access_status: "grandfathered",
      access_renews_at: null,
      checklist_fee_paid: true,
      device_limit: 2,
      custom_item_bonus: 0,
      role: "customer",
      preferred_state: "CA",
      created_at: created,
      updated_at: created,
    },
    group: {
      id: "00000000-0000-4000-8000-000000000201",
      name: "Carter Family",
      createdBy: DEMO_USER_ID,
      hasSharedHousehold: true,
    },
    members: [
      {
        checklist: jasmine,
        permission: "own",
        progress: progressFromKeys(DEMO_USER_ID, jasmineKeys, currentId, created),
        customItems: [],
      },
      {
        checklist: nana,
        permission: "edit",
        progress: progressFromKeys(DEMO_JIMMY_ID, nanaKeys, currentId, created),
        customItems: [],
      },
      {
        checklist: jaxson,
        permission: "view",
        progress: progressFromKeys(DEMO_BOBBY_ID, jaxsonKeys, currentId, created),
        customItems: [],
      },
    ],
    householdProgress: progressFromKeys(DEMO_USER_ID, householdKeys, currentId, created),
    householdCustomItems: [],
    invitations: [],
    contacts: [
      {
        id: "00000000-0000-4000-8000-000000000021",
        user_id: DEMO_USER_ID,
        name: "Jill",
        phone: "555-0142",
        label: "Neighbor",
        created_at: created,
        updated_at: created,
      },
      {
        id: "00000000-0000-4000-8000-000000000022",
        user_id: DEMO_USER_ID,
        name: "Mom",
        phone: "555-0199",
        label: "Family",
        created_at: created,
        updated_at: created,
      },
    ],
    devices: [
      {
        id: currentId,
        user_id: DEMO_USER_ID,
        device_token_hash: "demo-current",
        nickname: "iPhone",
        device_description: guessDeviceDescription(),
        created_at: created,
        last_seen_at: created,
      },
      {
        id: otherId,
        user_id: DEMO_USER_ID,
        device_token_hash: "demo-other",
        nickname: "MacBook",
        device_description: "Mac",
        created_at: created,
        last_seen_at: created,
      },
    ],
    currentDeviceId: currentId,
    activeView: { kind: "personal", checklistId: DEMO_JASMINE_LIST },
  };
}

function readState(): DemoState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      parsed.profile = normalizeDemoProfile(parsed.profile);
      parsed.members = parsed.members ?? defaultState().members;
      parsed.invitations = parsed.invitations ?? [];
      parsed.householdCustomItems = parsed.householdCustomItems ?? [];
      parsed.householdProgress = parsed.householdProgress ?? {};
      parsed.activeView = parsed.activeView ?? { kind: "personal", checklistId: DEMO_JASMINE_LIST };
      return parsed;
    }
  } catch {
    /* ignore */
  }
  const seeded = defaultState();
  localStorage.setItem(STATE_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeState(state: DemoState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function normalizeDemoProfile(row: Profile): Profile {
  return {
    ...row,
    first_name: row.first_name ?? personName(row).split(" ")[0] ?? null,
    last_name: row.last_name ?? null,
    display_name: row.display_name ?? row.first_name ?? personName(row),
    phone: row.phone ?? null,
    avatar_url: row.avatar_url ?? null,
    custom_item_bonus: row.custom_item_bonus ?? 0,
  };
}

function activeMember(state: DemoState) {
  const id = state.activeView.checklistId || DEMO_JASMINE_LIST;
  return state.members.find((m) => m.checklist.id === id) || state.members[0];
}

export function demoSignedIn() {
  return localStorage.getItem(SESSION_KEY) === "1";
}

export function demoUser(): User {
  return {
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    app_metadata: {},
    user_metadata: { full_name: "Jasmine Carter" },
    aud: "authenticated",
    created_at: defaultState().profile.created_at,
  } as User;
}

export function demoSession(): Session {
  return {
    access_token: "demo-access",
    refresh_token: "demo-refresh",
    expires_in: 60 * 60 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    token_type: "bearer",
    user: demoUser(),
  } as Session;
}

export function demoSignIn(email: string, password: string) {
  if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    throw new Error("Invalid login. Use demo@demo.com / Abc123!");
  }
  localStorage.setItem(SESSION_KEY, "1");
  const state = readState();
  const own = state.members.find((m) => m.permission === "own") || state.members[0];
  state.activeView = { kind: "personal", checklistId: own.checklist.id };
  writeState(state);
}

export function demoSignOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function demoViewing(): ViewingContext {
  const state = readState();
  if (state.activeView.kind === "household") {
    return {
      kind: "household",
      checklistId: null,
      ownerUserId: DEMO_USER_ID,
      publicId: null,
      title: "Survival Vault",
      ownerName: "Survival Vault",
      avatarUrl: null,
      permission: "edit",
      isOwn: false,
      canEdit: true,
    };
  }
  const member = activeMember(state);
  const name = member.checklist.displayName;
  const isOwn = member.permission === "own";
  return {
    kind: "personal",
    checklistId: member.checklist.id,
    ownerUserId: member.checklist.ownerUserId,
    publicId: member.checklist.publicId,
    title: checklistTitle(name),
    ownerName: name,
    avatarUrl: member.checklist.avatarUrl,
    permission: member.permission,
    isOwn,
    canEdit: isOwn || member.permission === "edit",
  };
}

export function loadDemoAccount() {
  const state = readState();
  const viewing = demoViewing();
  const own = state.members.find((m) => m.permission === "own") || state.members[0];
  const connected: ConnectedChecklist[] = state.members
    .filter((m) => m.permission !== "own")
    .map((m) => ({
      ...m.checklist,
      permission: m.permission,
      pending: m.checklist.status === "pending_claim",
    }));
  const progress =
    viewing.kind === "household" ? state.householdProgress : activeMember(state).progress;
  const customItems =
    viewing.kind === "household" ? state.householdCustomItems : activeMember(state).customItems;
  return {
    profile: state.profile,
    progress,
    customItems,
    contacts: state.contacts,
    devices: state.devices,
    currentDevice: state.devices.find((d) => d.id === state.currentDeviceId) || state.devices[0] || null,
    viewing,
    myChecklist: own.checklist,
    connectedChecklists: connected,
    invitations: state.invitations,
    group: state.group,
    members: state.members.map((m) => ({
      ...m.checklist,
      permission: m.permission,
      pending: m.checklist.status === "pending_claim",
    })),
  };
}

export function demoSwitchView(kind: ViewingKind, checklistId?: string | null) {
  const state = readState();
  state.activeView = { kind, checklistId: checklistId ?? null };
  writeState(state);
}

function writeActiveProgress(itemId: string, checked: boolean, note: string) {
  const state = readState();
  const viewing = demoViewing();
  if (!viewing.canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
  const row: ProgressRow = {
    id: `prog-${itemId}`,
    user_id: viewing.ownerUserId || DEMO_USER_ID,
    checklist_item_id: itemId,
    checked,
    note: note.slice(0, 100),
    updated_by_device_id: state.currentDeviceId,
    updated_at: nowIso(),
  };
  if (viewing.kind === "household") {
    state.householdProgress = { ...state.householdProgress, [itemId]: row };
  } else {
    const member = activeMember(state);
    member.progress = { ...member.progress, [itemId]: row };
    state.members = state.members.map((m) => (m.checklist.id === member.checklist.id ? member : m));
  }
  writeState(state);
  return row;
}

export function demoSaveProgress(itemId: string, checked: boolean, note: string) {
  return writeActiveProgress(itemId, checked, note);
}

export function demoAddContact(name: string, phone: string, label: string) {
  const state = readState();
  if (state.contacts.length >= 25) throw new Error("CONTACT_LIMIT_REACHED");
  const row: Contact = {
    id: crypto.randomUUID(),
    user_id: DEMO_USER_ID,
    name,
    phone,
    label,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.contacts = [...state.contacts, row];
  writeState(state);
  return row;
}

export function demoRemoveContact(id: string) {
  const state = readState();
  state.contacts = state.contacts.filter((c) => c.id !== id);
  writeState(state);
}

export function demoRenameDevice(id: string, nickname: string) {
  const state = readState();
  state.devices = state.devices.map((d) => (d.id === id ? { ...d, nickname: nickname.slice(0, 40) } : d));
  writeState(state);
}

export function demoRemoveDevice(id: string) {
  const state = readState();
  state.devices = state.devices.filter((d) => d.id !== id);
  if (state.currentDeviceId === id) state.currentDeviceId = state.devices[0]?.id || "";
  writeState(state);
}

export function demoSetPreferredState(code: string) {
  const state = readState();
  state.profile = { ...state.profile, preferred_state: code || null, updated_at: nowIso() };
  writeState(state);
}

export function demoUpdateProfile(
  patch: Partial<Pick<Profile, "full_name" | "first_name" | "last_name" | "display_name" | "phone" | "avatar_url">>,
) {
  const state = readState();
  const next = { ...state.profile, ...patch, updated_at: nowIso() };
  if (patch.first_name !== undefined || patch.last_name !== undefined || patch.full_name !== undefined) {
    const first = next.first_name || firstNameFrom(next.full_name);
    const last = next.last_name || lastNameFrom(next.full_name);
    next.first_name = first;
    next.last_name = last;
    next.full_name = [first, last].filter(Boolean).join(" ") || next.full_name;
  }
  state.profile = next;
  const own = state.members.find((m) => m.permission === "own");
  if (own) {
    own.checklist = {
      ...own.checklist,
      firstName: next.first_name,
      lastName: next.last_name,
      displayName: next.display_name || [next.first_name, next.last_name].filter(Boolean).join(" ") || own.checklist.displayName,
      avatarUrl: next.avatar_url,
    };
  }
  writeState(state);
}

function firstNameFrom(full?: string | null) {
  return full?.trim().split(/\s+/)[0] || null;
}
function lastNameFrom(full?: string | null) {
  const parts = full?.trim().split(/\s+/) || [];
  return parts.slice(1).join(" ") || null;
}

export function demoAddCustomItem(sectionId: string, text: string, description?: string | null) {
  const state = readState();
  const viewing = demoViewing();
  if (!viewing.canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
  const clipped = text.trim().slice(0, 120);
  if (!clipped) throw new Error("Item text is required");
  const bucket = viewing.kind === "household" ? state.householdCustomItems : activeMember(state).customItems;
  const used = bucket.filter((item) => item.section_id === sectionId).length;
  if (used >= customItemCap()) throw new Error(ITEM_LIMIT_ERROR);
  const sortOrder = Math.max(0, ...bucket.filter((item) => item.section_id === sectionId).map((item) => item.sort_order)) + 1;
  const created = nowIso();
  const row: CustomChecklistItem = {
    id: crypto.randomUUID(),
    user_id: viewing.ownerUserId || DEMO_USER_ID,
    section_id: sectionId,
    text: clipped,
    description: description?.trim().slice(0, 280) || null,
    sort_order: sortOrder,
    checked: false,
    note: "",
    created_at: created,
    updated_at: created,
  };
  if (viewing.kind === "household") {
    state.householdCustomItems = [...state.householdCustomItems, row];
  } else {
    const member = activeMember(state);
    member.customItems = [...member.customItems, row];
    state.members = state.members.map((m) => (m.checklist.id === member.checklist.id ? member : m));
  }
  writeState(state);
  return row;
}

export function demoSaveCustomProgress(itemId: string, checked: boolean, note: string) {
  const state = readState();
  const viewing = demoViewing();
  if (!viewing.canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
  const list = viewing.kind === "household" ? state.householdCustomItems : activeMember(state).customItems;
  const existing = list.find((item) => item.id === itemId);
  if (!existing) throw new Error("Unknown custom item");
  const row: CustomChecklistItem = { ...existing, checked, note: note.slice(0, 100), updated_at: nowIso() };
  if (viewing.kind === "household") {
    state.householdCustomItems = state.householdCustomItems.map((item) => (item.id === itemId ? row : item));
  } else {
    const member = activeMember(state);
    member.customItems = member.customItems.map((item) => (item.id === itemId ? row : item));
    state.members = state.members.map((m) => (m.checklist.id === member.checklist.id ? member : m));
  }
  const progress = writeActiveProgress(itemId, checked, row.note);
  return { item: row, progress };
}

export function demoRemoveCustomItem(id: string) {
  const state = readState();
  const viewing = demoViewing();
  if (!viewing.canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
  if (viewing.kind === "household") {
    state.householdCustomItems = state.householdCustomItems.filter((item) => item.id !== id);
    const next = { ...state.householdProgress };
    delete next[id];
    state.householdProgress = next;
  } else {
    const member = activeMember(state);
    member.customItems = member.customItems.filter((item) => item.id !== id);
    const next = { ...member.progress };
    delete next[id];
    member.progress = next;
    state.members = state.members.map((m) => (m.checklist.id === member.checklist.id ? member : m));
  }
  writeState(state);
}

export function demoSetPermission(checklistId: string, permission: ChecklistPermission) {
  const state = readState();
  state.members = state.members.map((m) =>
    m.checklist.id === checklistId && m.permission !== "own" ? { ...m, permission } : m,
  );
  writeState(state);
}

export function demoRevokeAccess(checklistId: string) {
  const state = readState();
  state.members = state.members.filter((m) => m.checklist.id !== checklistId || m.permission === "own");
  if (state.activeView.checklistId === checklistId) {
    state.activeView = { kind: "personal", checklistId: DEMO_JASMINE_LIST };
  }
  writeState(state);
}

export function demoInviteMember(firstName: string, lastName: string, email: string) {
  const state = readState();
  const id = crypto.randomUUID();
  const checklist = memberChecklist({
    id,
    publicId: `SPL-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
    ownerUserId: null,
    purchasedByUserId: DEMO_USER_ID,
    status: "pending_claim",
    firstName,
    lastName,
    email,
    avatarUrl: null,
  });
  state.members = [
    ...state.members,
    { checklist, permission: "view", progress: {}, customItems: [] },
  ];
  state.invitations = [
    ...state.invitations,
    {
      id: crypto.randomUUID(),
      checklistId: id,
      invitedEmail: email,
      invitedName: [firstName, lastName].filter(Boolean).join(" "),
      status: "pending",
      createdAt: nowIso(),
    },
  ];
  writeState(state);
  return checklist;
}

export function demoCancelInvitation(checklistId: string) {
  const state = readState();
  state.members = state.members.filter((m) => m.checklist.id !== checklistId);
  state.invitations = state.invitations.map((inv) =>
    inv.checklistId === checklistId ? { ...inv, status: "cancelled" } : inv,
  );
  writeState(state);
}

export function demoGrantHousehold() {
  const state = readState();
  state.profile = { ...state.profile, plan: "full", updated_at: nowIso() };
  state.group = { ...state.group, hasSharedHousehold: true };
  writeState(state);
}
