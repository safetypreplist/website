import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { invokeFunction, supabase } from "../lib/supabase";
import {
  demoAddContact,
  demoAddCustomItem,
  demoCancelInvitation,
  demoCatalog,
  demoChangePassword,
  demoInviteMember,
  demoRemoveContact,
  demoRemoveCustomItem,
  demoRemoveDevice,
  demoRenameDevice,
  demoRevokeAccess,
  demoSaveCustomProgress,
  demoSaveProgress,
  demoSaveProgressBatch,
  demoSession,
  demoSetPermission,
  demoSetPreferredState,
  demoSignIn,
  demoSignOut,
  demoSignedIn,
  demoSwitchView,
  demoUpdateProfile,
  DEMO_PREVIEW_EMAIL,
  isDemoMode,
  loadDemoAccount,
} from "../lib/demo";
import {
  getOrCreateDeviceToken,
  guessDeviceDescription,
  hashDeviceToken,
  suggestedNickname,
} from "../lib/device";
import { blobToDataUrl, compressAvatar } from "../lib/avatar";
import { checklistTitle, personName } from "../lib/identity";
import { hasSurvivalVault } from "../lib/plan";
import { isOnline } from "../lib/offline";
import {
  clearLegacyCaches,
  deleteOp,
  deleteOpsForUser,
  listOps,
  migrateLegacyQueue,
  opKey,
  prepareStorage,
  putOp,
  readSnapshot,
  settleOp,
  remapQueuedItems,
  removeSnapshots,
  forgetStoredSession,
  setSignedOutReason,
  storedSession,
  writeSnapshot,
  type AccessSnapshot,
  type OwnerData,
  type QueuedOp,
  type Snapshot,
  type StorageStatus,
} from "../lib/offlineStore";
import { accessMode as computeAccessMode, type AccessMode } from "../lib/accessPolicy";
import { ConfirmDialog } from "../components/ConfirmDialog";
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
  FamilyInviteResult,
  PersonalChecklist,
  PlanGroup,
  Product,
  Profile,
  ProgressRow,
  SafetyContact,
  ViewingContext,
  ViewingKind,
} from "../types";
import { customCountInSection, customItemCap, ITEM_LIMIT_ERROR } from "../lib/customItems";

type SyncState = "idle" | "saving" | "saved" | "waiting" | "error";
const VIEW_KEY = "spl.viewing.v1";

type Catalog = {
  systems: ChecklistSystem[];
  sections: ChecklistSection[];
  items: ChecklistItem[];
};

const EMPTY_CATALOG: Catalog = { systems: [], sections: [], items: [] };

export type SyncIssue = { key: string; itemLabel: string; message: string };

export type OfflineStatus = {
  pending: number;
  issues: SyncIssue[];
  conflicts: number;
  savedAt: string | null;
  preparedAt: string | null;
  usingSavedCopy: boolean;
  lastSyncedAt: string | null;
  storage: StorageStatus | null;
};

export type PrepareResult = { checklists: number; items: number; storage: StorageStatus };

const emptyOffline: OfflineStatus = {
  pending: 0,
  issues: [],
  conflicts: 0,
  savedAt: null,
  preparedAt: null,
  usingSavedCopy: false,
  lastSyncedAt: null,
  storage: null,
};

/** The library is served per login, filtered to what the account is entitled to read. */
async function loadLibrary(userId: string): Promise<Catalog | null> {
  try {
    const data = await invokeFunction<Omit<Catalog, "items"> & { items: (ChecklistItem & { bundled_id?: string })[] }>(
      "checklist-library",
      {},
    );
    await remapQueuedItems(
      userId,
      new Map(data.items.filter((item) => item.bundled_id).map((item) => [item.bundled_id as string, item.id])),
    );
    return {
      systems: data.systems,
      sections: data.sections,
      items: data.items.map(({ bundled_id: _bundled, ...item }) => item),
    };
  } catch (err) {
    console.warn(err);
    return null;
  }
}

type AppState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  catalog: Catalog;
  progress: Record<string, ProgressRow>;
  contacts: Contact[];
  devices: Device[];
  customItems: CustomChecklistItem[];
  products: Product[];
  safety: SafetyContact[];
  currentDevice: Device | null;
  deviceLimitReached: boolean;
  sync: SyncState;
  online: boolean;
  loading: boolean;
  demoMode: boolean;
  viewing: ViewingContext;
  myChecklist: PersonalChecklist | null;
  connectedChecklists: ConnectedChecklist[];
  familyMembers: ConnectedChecklist[];
  invitations: FamilyInvitation[];
  planGroup: PlanGroup | null;
  hasSurvivalVault: boolean;
  accessMode: AccessMode;
  offline: OfflineStatus;
  prepareOffline: () => Promise<PrepareResult>;
  retrySync: () => Promise<void>;
  discardChange: (key: string) => Promise<void>;
  saveProgress: (itemId: string, checked: boolean, note: string) => Promise<void>;
  saveProgressMany: (updates: { itemId: string; checked: boolean; note: string }[]) => Promise<void>;
  refreshAccount: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ role: string | null }>;
  changePassword: (password: string) => Promise<void>;
  signOut: (options?: { discardPending?: boolean }) => Promise<void>;
  addContact: (name: string, phone: string, label: string) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  addCustomItem: (sectionId: string, text: string, description?: string | null) => Promise<void>;
  removeCustomItem: (id: string) => Promise<void>;
  renameDevice: (id: string, nickname: string) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  setPreferredState: (code: string) => Promise<void>;
  updateProfile: (patch: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  switchChecklist: (kind: ViewingKind, checklistId?: string | null) => Promise<void>;
  setChecklistPermission: (checklistId: string, granteeUserId: string, permission: ChecklistPermission) => Promise<void>;
  revokeChecklistAccess: (checklistId: string, granteeUserId?: string) => Promise<void>;
  inviteFamilyMember: (
    firstName: string,
    lastName: string,
    email: string,
    checklistId?: string,
    permission?: ChecklistPermission,
  ) => Promise<FamilyInviteResult>;
  setFamilyAccess: (checklistId: string, permission: ChecklistPermission) => Promise<void>;
  resendInvite: (checklistId: string) => Promise<FamilyInviteResult>;
  cancelInvitation: (checklistId: string) => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

const emptyViewing: ViewingContext = {
  kind: "personal",
  checklistId: null,
  ownerUserId: null,
  publicId: null,
  title: "My Checklist",
  ownerName: "My",
  avatarUrl: null,
  permission: "own",
  isOwn: true,
  canEdit: true,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({ systems: [], sections: [], items: [] });
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [customItems, setCustomItems] = useState<CustomChecklistItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [safety, setSafety] = useState<SafetyContact[]>([]);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [deviceLimitReached, setDeviceLimitReached] = useState(false);
  const [sync, setSync] = useState<SyncState>("idle");
  const [online, setOnline] = useState(isOnline());
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ViewingContext>(emptyViewing);
  const [myChecklist, setMyChecklist] = useState<PersonalChecklist | null>(null);
  const [connectedChecklists, setConnectedChecklists] = useState<ConnectedChecklist[]>([]);
  const [familyMembers, setFamilyMembers] = useState<ConnectedChecklist[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [planGroup, setPlanGroup] = useState<PlanGroup | null>(null);
  const [access, setAccess] = useState<AccessSnapshot | null>(null);
  const [offline, setOffline] = useState<OfflineStatus>(emptyOffline);
  const [signOutPrompt, setSignOutPrompt] = useState<{ count: number; resolve: (keep: boolean) => void } | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const viewingRef = useRef<ViewingContext>(emptyViewing);
  const catalogRef = useRef<Catalog>(EMPTY_CATALOG);
  const flushing = useRef(false);
  const flushAgain = useRef(false);
  const usingSavedCopy = useRef(false);
  const refreshGen = useRef(0);
  const registeredDeviceUser = useRef<string | null>(null);
  const libraryKey = useRef<string | null>(null);
  const pendingProgress = useRef<Record<string, ProgressRow>>({});
  const progressSaveChain = useRef<Record<string, Promise<void>>>({});

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const loadPublic = useCallback(async () => {
    if (isDemoMode()) {
      const data = demoCatalog();
      setCatalog({ systems: data.systems, sections: data.sections, items: data.items });
      setProducts(data.products);
      setSafety(data.safety);
      return;
    }
    const [productRows, safetyRows] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("safety_contacts").select("*").eq("active", true).order("sort_order"),
    ]);
    setProducts((productRows.data as Product[]) || []);
    setSafety((safetyRows.data as SafetyContact[]) || []);
  }, []);

  const registerThisDevice = useCallback(async (): Promise<Device | null> => {
    const token = getOrCreateDeviceToken();
    const hash = await hashDeviceToken(token);
    const { data, error } = await supabase.rpc("register_device", {
      p_token_hash: hash,
      p_nickname: suggestedNickname(),
      p_description: guessDeviceDescription(),
    });
    if (error) {
      if (error.message?.includes("DEVICE_LIMIT_REACHED")) {
        const demoLogin = sessionRef.current?.user.email?.trim().toLowerCase() === DEMO_PREVIEW_EMAIL;
        setDeviceLimitReached(!demoLogin);
        setCurrentDevice(null);
        return null;
      }
      if (error.message?.includes("SESSION_ENDED")) {
        setSignedOutReason("device_removed");
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) {
          forgetStoredSession();
          window.location.assign("/signin");
        }
        return null;
      }
      console.warn(error);
      return null;
    }
    setDeviceLimitReached(false);
    setCurrentDevice(data as Device);
    return data as Device;
  }, []);

  const refreshQueueState = useCallback(async (userId: string) => {
    const ops = await listOps(userId);
    const items = new Map(catalogRef.current.items.map((item) => [item.id, item.text]));
    setOffline((prev) => ({
      ...prev,
      pending: ops.length,
      issues: ops
        .filter((op) => op.blocked)
        .map((op) => ({
          key: op.key,
          itemLabel: items.get(op.itemId) || op.text || "A custom item",
          message: op.lastError || "This change could not be saved to your account.",
        })),
    }));
    setSync(ops.length ? "waiting" : "saved");
    return ops;
  }, []);

  /** Shows the copy saved on this device when the account cannot be reached. */
  const applySavedCopy = useCallback(async (userId: string, gen: number) => {
    const saved = await readSnapshot(userId);
    if (gen !== refreshGen.current) return;
    usingSavedCopy.current = true;
    if (!saved) {
      setOffline((prev) => ({ ...prev, usingSavedCopy: true, savedAt: null, preparedAt: null }));
      await refreshQueueState(userId);
      return;
    }
    const resolved = resolveViewing(readStoredView(), saved.family, saved.profile);
    const ownerId = resolved.kind === "household" ? saved.family.group?.createdBy || userId : resolved.ownerUserId || userId;
    const owner = saved.owners[ownerId] || { progress: {}, customItems: [], savedAt: saved.savedAt };
    const overlaid = overlayQueue(await listOps(userId), ownerId, owner.progress, owner.customItems);
    if (gen !== refreshGen.current) return;
    catalogRef.current = saved.catalog;
    setCatalog(saved.catalog);
    setProfile(saved.profile);
    setContacts(saved.contacts);
    setDevices(saved.devices);
    setCurrentDevice(saved.currentDevice);
    setMyChecklist(saved.family.mine);
    setConnectedChecklists(saved.family.connected);
    setFamilyMembers(saved.family.members);
    setInvitations(saved.family.invitations);
    setPlanGroup(saved.family.group);
    setAccess(saved.access);
    viewingRef.current = resolved;
    setViewing(resolved);
    setCustomItems(overlaid.customItems);
    setProgress(overlaid.progress);
    setOffline((prev) => ({
      ...prev,
      usingSavedCopy: true,
      savedAt: saved.savedAt,
      preparedAt: saved.preparedAt,
    }));
    await refreshQueueState(userId);
  }, [refreshQueueState]);

  /** Sends queued edits in order. Each edit carries its own owner, so switching checklists never misroutes it. */
  const flush = useCallback(async (options?: { retryBlocked?: boolean }) => {
    const userId = sessionRef.current?.user.id;
    if (isDemoMode() || !userId || !navigator.onLine || usingSavedCopy.current) return;
    if (flushing.current) {
      flushAgain.current = true;
      return;
    }
    flushing.current = true;
    let snapshot: Snapshot | null = null;
    let conflicts = 0;
    let synced = false;
    let halted = false;
    try {
      const token = getOrCreateDeviceToken();
      do {
        flushAgain.current = false;
        for (const op of await listOps(userId)) {
          if (op.blocked && !options?.retryBlocked) continue;
          const result = await sendOp(op, token);
          if (result.kind === "offline") {
            halted = true;
            break;
          }
          if (result.kind === "failed") {
            await settleOp(op, {
              ...op,
              attempts: op.attempts + 1,
              lastError: result.message,
              blocked: result.blocked || op.attempts + 1 >= 5,
            });
            if (result.stop) {
              halted = true;
              break;
            }
            continue;
          }
          await settleOp(op, null);
          synced = true;
          if (result.conflict) conflicts += 1;
          snapshot = snapshot || (await readSnapshot(userId));
          applySyncedRow(op, result, snapshot);
          const current = viewingRef.current.ownerUserId || userId;
          if (result.progress && (op.ownerUserId === current || viewingRef.current.kind === "household")) {
            const row = result.progress;
            const pending = pendingProgress.current[row.checklist_item_id];
            if (!pending || pending.updated_at <= op.editedAt) delete pendingProgress.current[row.checklist_item_id];
            if (!pendingProgress.current[row.checklist_item_id]) {
              setProgress((prev) => ({ ...prev, [row.checklist_item_id]: row }));
            }
          }
          if (result.custom) {
            const row = result.custom;
            setCustomItems((prev) => (prev.some((item) => item.id === row.id) ? prev.map((item) => (item.id === row.id ? row : item)) : prev));
            if (result.conflict) setProgress((prev) => mergeCustomProgress(prev, [row]));
          }
          if (result.removed) {
            setCustomItems((prev) => prev.filter((item) => item.id !== op.itemId));
          }
        }
      } while (flushAgain.current && !halted);
    } finally {
      flushing.current = false;
    }
    if (snapshot) await writeSnapshot(snapshot);
    const remaining = await refreshQueueState(userId);
    setOffline((prev) => ({
      ...prev,
      conflicts: prev.conflicts + conflicts,
      lastSyncedAt: synced && !remaining.length ? new Date().toISOString() : prev.lastSyncedAt,
    }));
  }, [refreshQueueState]);

  const refreshAccount = useCallback(async () => {
    if (isDemoMode()) {
      if (!demoSignedIn()) {
        setSession(null);
        setProfile(null);
        setProgress({});
        setContacts([]);
        setDevices([]);
        setCustomItems([]);
        setCurrentDevice(null);
        setDeviceLimitReached(false);
        setViewing(emptyViewing);
        setMyChecklist(null);
        setConnectedChecklists([]);
        setFamilyMembers([]);
        setInvitations([]);
        setPlanGroup(null);
        return;
      }
      const account = loadDemoAccount();
      setSession(demoSession());
      setProfile(normalizeProfile(account.profile));
      setCustomItems(account.customItems);
      setProgress(mergeCustomProgress(account.progress, account.customItems));
      setContacts(account.contacts);
      setDevices(account.devices);
      setCurrentDevice(account.currentDevice);
      setDeviceLimitReached(false);
      setViewing(account.viewing);
      setMyChecklist(account.myChecklist);
      setConnectedChecklists(account.connectedChecklists);
      setFamilyMembers(account.members);
      setInvitations(account.invitations);
      setPlanGroup(account.group);
      return;
    }
    const gen = ++refreshGen.current;
    const live = await liveSession();
    if (gen !== refreshGen.current) return;
    let next = live.session;
    const unreachable = !navigator.onLine || live.unreachable;
    if (!next && unreachable) next = storedSession();
    const prev = sessionRef.current;
    if (prev && next && prev.user.id === next.user.id && prev.access_token === next.access_token) next = prev;
    sessionRef.current = next;
    setSession(next);
    if (next?.user && unreachable) {
      await applySavedCopy(next.user.id, gen);
      return;
    }
    if (!next?.user) {
      pendingProgress.current = {};
      registeredDeviceUser.current = null;
      libraryKey.current = null;
      usingSavedCopy.current = false;
      catalogRef.current = EMPTY_CATALOG;
      setCatalog(EMPTY_CATALOG);
      setAccess(null);
      setOffline(emptyOffline);
      setProfile(null);
      setProgress({});
      setContacts([]);
      setDevices([]);
      setCustomItems([]);
      setCurrentDevice(null);
      setViewing(emptyViewing);
      setMyChecklist(null);
      setConnectedChecklists([]);
      setFamilyMembers([]);
      setInvitations([]);
      setPlanGroup(null);
      return;
    }
    const userId = next.user.id;
    const [prof, cons, devs, accessRow] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("contacts").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("devices").select("*").eq("user_id", userId).order("created_at"),
      supabase.rpc("my_access"),
    ]);
    if (gen !== refreshGen.current) return;
    if (isNetworkError(prof.error)) {
      await applySavedCopy(userId, gen);
      return;
    }
    await removeSnapshots(userId);
    await migrateLegacyQueue(userId);
    const loadedProfile = normalizeProfile((prof.data as Profile) || null);
    const loadedFamily = await loadLiveFamily(userId, loadedProfile);
    const granted = grantDemoPreview(loadedProfile, loadedFamily);
    const nextProfile = granted.profile;
    const family = granted.family;
    const stored = readStoredView();
    const resolved = resolveViewing(stored, family, nextProfile);
    const ownerId = resolved.kind === "household" ? family.group?.createdBy || userId : resolved.ownerUserId || userId;
    const nextLibraryKey = `${userId}:${nextProfile?.plan || "none"}:${hasSurvivalVault(nextProfile?.plan, family.group?.hasSharedHousehold) ? "v" : ""}`;
    const [prog, custom, library, saved] = await Promise.all([
      supabase.from("checklist_progress").select("*").eq("user_id", ownerId),
      supabase.from("custom_checklist_items").select("*").eq("user_id", ownerId).order("sort_order"),
      libraryKey.current === nextLibraryKey ? Promise.resolve(null) : loadLibrary(userId),
      readSnapshot(userId),
    ]);
    if (gen !== refreshGen.current) return;
    let nextCatalog = catalogRef.current;
    if (library) {
      libraryKey.current = nextLibraryKey;
      nextCatalog = library;
    } else if (!nextCatalog.items.length && saved?.catalog.items.length) {
      nextCatalog = saved.catalog;
    }
    catalogRef.current = nextCatalog;
    setCatalog(nextCatalog);
    const nextAccess = accessRow.error ? saved?.access ?? null : toAccessSnapshot(accessRow.data);
    setAccess(nextAccess);
    const ops = await listOps(userId);
    const serverCustom = custom.error ? saved?.owners[ownerId]?.customItems ?? [] : ((custom.data as CustomChecklistItem[]) || []);
    const map: Record<string, ProgressRow> = {};
    if (!prog.error) {
      for (const row of (prog.data as ProgressRow[]) || []) {
        map[row.checklist_item_id] = row;
      }
    }
    const serverProgress = prog.error ? saved?.owners[ownerId]?.progress ?? {} : map;
    const overlaid = overlayQueue(ops, ownerId, mergeServerProgress(serverProgress, pendingProgress.current), serverCustom);
    setProfile(nextProfile);
    const nextContacts = cons.error ? saved?.contacts ?? [] : ((cons.data as Contact[]) || []);
    const nextDevices = devs.error ? saved?.devices ?? [] : ((devs.data as Device[]) || []);
    setContacts(nextContacts);
    setDevices(nextDevices);
    setMyChecklist(family.mine);
    setConnectedChecklists(family.connected);
    setFamilyMembers(family.members);
    setInvitations(family.invitations);
    setPlanGroup(family.group);
    viewingRef.current = resolved;
    setViewing(resolved);
    setCustomItems(overlaid.customItems);
    setProgress(overlaid.progress);
    usingSavedCopy.current = false;
    let device: Device | null = null;
    if (nextProfile && nextProfile.plan !== "none") {
      if (registeredDeviceUser.current !== userId) {
        device = await registerThisDevice();
        registeredDeviceUser.current = device ? userId : null;
      }
    } else {
      registeredDeviceUser.current = null;
      setDeviceLimitReached(false);
    }
    if (gen !== refreshGen.current) return;
    const snapshot: Snapshot = {
      userId,
      savedAt: new Date().toISOString(),
      preparedAt: saved?.preparedAt ?? null,
      profile: nextProfile,
      catalog: nextCatalog,
      family,
      contacts: nextContacts,
      devices: nextDevices,
      currentDevice: device ?? saved?.currentDevice ?? null,
      access: nextAccess,
      owners: {
        ...(saved?.owners || {}),
        ...(prog.error || custom.error
          ? {}
          : { [ownerId]: { progress: serverProgress, customItems: serverCustom, savedAt: new Date().toISOString() } }),
      },
    };
    if (nextCatalog.items.length) await writeSnapshot(snapshot);
    setOffline((prev) => ({
      ...prev,
      usingSavedCopy: false,
      savedAt: nextCatalog.items.length ? snapshot.savedAt : saved?.savedAt ?? null,
      preparedAt: snapshot.preparedAt,
    }));
    await refreshQueueState(userId);
    void flush({ retryBlocked: Boolean(device) });
  }, [registerThisDevice]);

  useEffect(() => {
    let ignore = false;
    async function boot() {
      const publicRows = loadPublic().catch(() => undefined);
      const publicWait = navigator.onLine
        ? Promise.race([publicRows, new Promise((resolve) => window.setTimeout(resolve, SESSION_TIMEOUT_MS))])
        : undefined;
      await Promise.all([publicWait, refreshAccount()]);
      if (!ignore) setLoading(false);
    }
    void boot();
    if (isDemoMode()) {
      return () => {
        ignore = true;
      };
    }
    void clearLegacyCaches();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "TOKEN_REFRESHED") {
        if (usingSavedCopy.current) void refreshAccount();
        return;
      }
      if (event === "SIGNED_OUT") void removeSnapshots();
      void refreshAccount();
    });
    return () => {
      ignore = true;
      data.subscription.unsubscribe();
    };
  }, [loadPublic, refreshAccount]);

  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    if (isDemoMode() || !sessionUserId) return;
    const ownerId = viewing.ownerUserId || sessionUserId;
    const userId = sessionUserId;
    const channel = supabase
      .channel("account-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_progress", filter: `user_id=eq.${ownerId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = (payload.old || payload.new) as ProgressRow;
            if (!row?.checklist_item_id || pendingProgress.current[row.checklist_item_id]) return;
            setProgress((prev) => {
              const next = { ...prev };
              delete next[row.checklist_item_id];
              return next;
            });
            return;
          }
          const incoming = payload.new as ProgressRow;
          if (!isProgressRow(incoming)) return;
          const local = pendingProgress.current[incoming.checklist_item_id];
          if (local && newerProgress(local, incoming) === local) return;
          if (local && local.checked === incoming.checked && local.note === incoming.note) {
            delete pendingProgress.current[incoming.checklist_item_id];
          }
          setProgress((prev) => ({ ...prev, [incoming.checklist_item_id]: incoming }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = (payload.old || payload.new) as Contact;
            if (!row?.id) return;
            setContacts((prev) => prev.filter((contact) => contact.id !== row.id));
            return;
          }
          const row = payload.new as Contact;
          if (!row?.id) return;
          setContacts((prev) => {
            const index = prev.findIndex((contact) => contact.id === row.id);
            if (index === -1) return [...prev, row];
            const next = [...prev];
            next[index] = row;
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = (payload.old || payload.new) as Device;
            if (!row?.id) return;
            setDevices((prev) => prev.filter((device) => device.id !== row.id));
            return;
          }
          const row = payload.new as Device;
          if (!row?.id) return;
          setDevices((prev) => {
            const index = prev.findIndex((device) => device.id === row.id);
            if (index === -1) return [...prev, row];
            const next = [...prev];
            next[index] = row;
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_checklist_items", filter: `user_id=eq.${ownerId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const row = (payload.old || payload.new) as CustomChecklistItem;
            if (!row?.id) return;
            setCustomItems((prev) => prev.filter((item) => item.id !== row.id));
            setProgress((prev) => {
              if (pendingProgress.current[row.id]) return prev;
              const next = { ...prev };
              delete next[row.id];
              return next;
            });
            return;
          }
          const row = payload.new as CustomChecklistItem;
          if (!row?.id) return;
          setCustomItems((prev) => {
            const index = prev.findIndex((item) => item.id === row.id);
            if (index === -1) return [...prev, row];
            const next = [...prev];
            next[index] = row;
            return next;
          });
          setProgress((prev) => mergeCustomProgress(prev, [row]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionUserId, viewing.ownerUserId]);

  const queueEdit = useCallback(async (op: Omit<QueuedOp, "key" | "userId" | "attempts" | "lastError" | "blocked">) => {
    const userId = sessionRef.current?.user.id;
    if (!userId) return;
    await putOp({
      ...op,
      userId,
      key: opKey(userId, op.kind, op.itemId, op.ownerUserId),
      attempts: 0,
      lastError: null,
      blocked: false,
    });
  }, []);

  const syncNow = useCallback(async () => {
    const userId = sessionRef.current?.user.id;
    if (!userId) return;
    if (navigator.onLine && !usingSavedCopy.current) {
      setSync("saving");
      await flush();
    } else {
      await refreshQueueState(userId);
    }
  }, [flush, refreshQueueState]);

  const reconnecting = useRef<Promise<void> | null>(null);
  /** Background retries must not start a second account load: each new load cancels the one in progress. */
  const resumeLive = useCallback(() => {
    if (!usingSavedCopy.current) {
      void flush();
      return;
    }
    if (reconnecting.current) return;
    reconnecting.current = refreshAccount().finally(() => {
      reconnecting.current = null;
    });
  }, [flush, refreshAccount]);

  useEffect(() => {
    if (!online || !sessionUserId || isDemoMode()) return;
    resumeLive();
  }, [online, sessionUserId, resumeLive]);

  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    if (isDemoMode() || !sessionUserId) return;
    const retry = () => {
      setClockTick((tick) => tick + 1);
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      resumeLive();
    };
    const timer = window.setInterval(retry, 60000);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [sessionUserId, resumeLive]);

  const mode: AccessMode = useMemo(() => {
    void clockTick;
    if (isDemoMode() || profile?.role === "owner") return "full";
    return computeAccessMode(myChecklist?.accessEndsAt ?? access?.accessEndsAt, access?.serverTime);
  }, [access, clockTick, myChecklist?.accessEndsAt, profile?.role]);
  const canEdit = viewing.canEdit && mode === "full";

  const saveProgress = useCallback(
    (itemId: string, checked: boolean, note: string) => {
      const run = async () => {
        if (!canEdit) return;
        const clipped = note.slice(0, 100);
        const custom = customItems.some((item) => item.id === itemId);
        const editedAt = new Date().toISOString();
        const ownerUserId = viewing.ownerUserId || session?.user.id || "";
        const optimistic: ProgressRow = {
          id: pendingProgress.current[itemId]?.id || itemId,
          user_id: ownerUserId,
          checklist_item_id: itemId,
          checked,
          note: clipped,
          updated_by_device_id: currentDevice?.id || null,
          updated_at: editedAt,
        };
        pendingProgress.current[itemId] = optimistic;
        setProgress((prev) => ({ ...prev, [itemId]: optimistic }));
        if (custom) {
          setCustomItems((prev) =>
            prev.map((item) => (item.id === itemId ? { ...item, checked, note: clipped, updated_at: editedAt } : item)),
          );
        }

        if (isDemoMode()) {
          if (custom) {
            const saved = demoSaveCustomProgress(itemId, checked, clipped);
            pendingProgress.current[itemId] = saved.progress;
            setCustomItems((prev) => prev.map((item) => (item.id === itemId ? saved.item : item)));
            setProgress((prev) => ({ ...prev, [itemId]: saved.progress }));
          } else {
            const row = demoSaveProgress(itemId, checked, clipped);
            pendingProgress.current[itemId] = row;
            setProgress((prev) => ({ ...prev, [itemId]: row }));
          }
          setSync("saved");
          return;
        }

        await queueEdit({
          ownerUserId,
          checklistId: viewing.checklistId,
          kind: custom ? "custom_progress" : "progress",
          itemId,
          checked,
          note: clipped,
          editedAt,
        });
        await syncNow();
      };

      const next = (progressSaveChain.current[itemId] || Promise.resolve()).then(run, run);
      progressSaveChain.current[itemId] = next;
      return next;
    },
    [canEdit, currentDevice?.id, customItems, queueEdit, session?.user.id, syncNow, viewing.checklistId, viewing.ownerUserId],
  );

  const saveProgressMany = useCallback(
    async (updates: { itemId: string; checked: boolean; note: string }[]) => {
      if (!canEdit || updates.length === 0) return;
      const editedAt = new Date().toISOString();
      const ownerUserId = viewing.ownerUserId || session?.user.id || "";
      const customIds = new Set(customItems.map((item) => item.id));
      const optimistic: Record<string, ProgressRow> = {};
      const clippedUpdates = updates.map((update) => ({
        ...update,
        note: update.note.slice(0, 100),
      }));

      for (const update of clippedUpdates) {
        const row: ProgressRow = {
          id: pendingProgress.current[update.itemId]?.id || update.itemId,
          user_id: ownerUserId,
          checklist_item_id: update.itemId,
          checked: update.checked,
          note: update.note,
          updated_by_device_id: currentDevice?.id || null,
          updated_at: editedAt,
        };
        optimistic[update.itemId] = row;
        pendingProgress.current[update.itemId] = row;
      }

      setProgress((prev) => ({ ...prev, ...optimistic }));
      setCustomItems((prev) =>
        prev.map((item) => {
          const update = clippedUpdates.find((row) => row.itemId === item.id);
          return update ? { ...item, checked: update.checked, note: update.note, updated_at: editedAt } : item;
        }),
      );

      if (isDemoMode()) {
        const saved = demoSaveProgressBatch(clippedUpdates);
        for (const [itemId, row] of Object.entries(saved.progress)) pendingProgress.current[itemId] = row;
        setProgress((prev) => ({ ...prev, ...saved.progress }));
        setCustomItems(saved.customItems);
        setSync("saved");
        return;
      }

      for (const update of clippedUpdates) {
        await queueEdit({
          ownerUserId,
          checklistId: viewing.checklistId,
          kind: customIds.has(update.itemId) ? "custom_progress" : "progress",
          itemId: update.itemId,
          checked: update.checked,
          note: update.note,
          editedAt,
        });
      }
      await syncNow();
    },
    [canEdit, currentDevice?.id, customItems, queueEdit, session?.user.id, syncNow, viewing.checklistId, viewing.ownerUserId],
  );

  const retrySync = useCallback(async () => {
    if (navigator.onLine) {
      registeredDeviceUser.current = null;
      await refreshAccount();
    }
    await flush({ retryBlocked: true });
  }, [flush, refreshAccount]);

  const discardChange = useCallback(async (key: string) => {
    const userId = sessionRef.current?.user.id;
    await deleteOp(key);
    if (userId) await refreshQueueState(userId);
    await refreshAccount();
  }, [refreshAccount, refreshQueueState]);

  /** Saves every checklist this login can open, so they all work without a connection. */
  const prepareOffline = useCallback(async (): Promise<PrepareResult> => {
    const userId = sessionRef.current?.user.id;
    if (!userId) throw new Error("Sign in first.");
    if (!navigator.onLine) throw new Error("Connect to the internet, then try again.");
    const storage = await prepareStorage();
    await refreshAccount();
    if (usingSavedCopy.current) throw new Error("Could not reach your account. Check your connection and try again.");
    const snapshot = await readSnapshot(userId);
    if (!snapshot) throw new Error("Could not save your checklists on this device. Check that this browser allows site storage.");
    const owners = new Set<string>([userId]);
    for (const member of [...snapshot.family.connected, ...snapshot.family.members]) {
      if (member.ownerUserId && !member.pending) owners.add(member.ownerUserId);
    }
    if (snapshot.family.group?.createdBy && hasSurvivalVault(snapshot.profile?.plan, snapshot.family.group.hasSharedHousehold)) {
      owners.add(snapshot.family.group.createdBy);
    }
    for (const ownerId of owners) {
      const [prog, custom] = await Promise.all([
        supabase.from("checklist_progress").select("*").eq("user_id", ownerId),
        supabase.from("custom_checklist_items").select("*").eq("user_id", ownerId).order("sort_order"),
      ]);
      if (prog.error || custom.error) continue;
      const map: Record<string, ProgressRow> = {};
      for (const row of (prog.data as ProgressRow[]) || []) map[row.checklist_item_id] = row;
      snapshot.owners[ownerId] = {
        progress: map,
        customItems: (custom.data as CustomChecklistItem[]) || [],
        savedAt: new Date().toISOString(),
      };
    }
    snapshot.preparedAt = new Date().toISOString();
    snapshot.savedAt = snapshot.preparedAt;
    if (!(await writeSnapshot(snapshot))) {
      throw new Error("This device is out of storage space. Free up some space, then try again.");
    }
    setOffline((prev) => ({ ...prev, preparedAt: snapshot.preparedAt, savedAt: snapshot.savedAt, storage }));
    return { checklists: owners.size, items: snapshot.catalog.items.length, storage };
  }, [refreshAccount]);

  const signIn = useCallback(async (email: string, password: string) => {
    storeView({ kind: "personal", checklistId: null });
    if (isDemoMode()) {
      demoSignIn(email, password);
      await refreshAccount();
      return { role: loadDemoAccount().profile.role };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshAccount();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { role: null };
    const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    return { role: data?.role ?? null };
  }, [refreshAccount]);

  const changePassword = useCallback(async (password: string) => {
    if (isDemoMode()) {
      demoChangePassword(password);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async (options?: { discardPending?: boolean }) => {
    const userId = sessionRef.current?.user.id;
    if (!isDemoMode() && userId) {
      if (options?.discardPending) {
        await deleteOpsForUser(userId);
      } else {
        const pending = await listOps(userId);
        if (pending.length) {
          const keep = await new Promise<boolean>((resolve) => setSignOutPrompt({ count: pending.length, resolve }));
          setSignOutPrompt(null);
          if (!keep) return;
        }
      }
    }
    if (isDemoMode()) demoSignOut();
    else {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) forgetStoredSession();
      await removeSnapshots();
    }
    sessionStorage.removeItem(VIEW_KEY);
    pendingProgress.current = {};
    registeredDeviceUser.current = null;
    libraryKey.current = null;
    usingSavedCopy.current = false;
    sessionRef.current = null;
    refreshGen.current += 1;
    if (!isDemoMode()) {
      catalogRef.current = EMPTY_CATALOG;
      setCatalog(EMPTY_CATALOG);
    }
    setAccess(null);
    setOffline(emptyOffline);
    setSession(null);
    setProfile(null);
    setProgress({});
    setContacts([]);
    setDevices([]);
    setCustomItems([]);
    setCurrentDevice(null);
    setViewing(emptyViewing);
    setMyChecklist(null);
    setConnectedChecklists([]);
    setFamilyMembers([]);
    setInvitations([]);
    setPlanGroup(null);
  }, []);

  const addContact = useCallback(async (name: string, phone: string, label: string) => {
    if (isDemoMode()) {
      demoAddContact(name, phone, label);
      await refreshAccount();
      return;
    }
    const { data, error } = await supabase
      .from("contacts")
      .insert({ name: name.trim(), phone: phone.trim(), label: label.trim(), user_id: session?.user.id })
      .select("*")
      .single();
    if (error) throw error;
    refreshGen.current += 1;
    const row = data as Contact;
    setContacts((prev) => (prev.some((contact) => contact.id === row.id) ? prev : [...prev, row]));
  }, [refreshAccount, session?.user.id]);

  const removeContact = useCallback(async (id: string) => {
    if (isDemoMode()) {
      demoRemoveContact(id);
      await refreshAccount();
      return;
    }
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) throw error;
    refreshGen.current += 1;
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
  }, [refreshAccount]);

  const addCustomItem = useCallback(async (sectionId: string, text: string, description?: string | null) => {
    if (!canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
    if (isDemoMode()) {
      demoAddCustomItem(sectionId, text, description);
      await refreshAccount();
      return;
    }
    const userId = sessionRef.current?.user.id;
    if (!userId) throw new Error("Sign in required.");
    if (customCountInSection(customItems, sectionId) >= customItemCap(profile?.custom_item_bonus)) {
      throw new Error(ITEM_LIMIT_ERROR);
    }
    const ownerUserId = viewing.ownerUserId || userId;
    const editedAt = new Date().toISOString();
    const id = crypto.randomUUID();
    const row: CustomChecklistItem = {
      id,
      user_id: ownerUserId,
      section_id: sectionId,
      text: text.trim().slice(0, 120),
      description: description?.trim().slice(0, 280) || null,
      sort_order: 1000 + customItems.length,
      checked: false,
      note: "",
      created_at: editedAt,
      updated_at: editedAt,
    };
    setCustomItems((prev) => [...prev, row]);
    setProgress((prev) => mergeCustomProgress(prev, [row]));
    await queueEdit({
      ownerUserId,
      checklistId: viewing.checklistId,
      kind: "custom_create",
      itemId: id,
      sectionId,
      text: row.text,
      description: row.description,
      editedAt,
    });
    await syncNow();
    const stuck = (await listOps(userId)).find((op) => op.key === opKey(userId, "custom_create", id, ownerUserId));
    if (stuck?.blocked && stuck.lastError?.includes("5 custom items")) {
      await deleteOp(stuck.key);
      setCustomItems((prev) => prev.filter((item) => item.id !== id));
      await refreshQueueState(userId);
      throw new Error(ITEM_LIMIT_ERROR);
    }
  }, [canEdit, customItems, profile?.custom_item_bonus, queueEdit, refreshAccount, refreshQueueState, syncNow, viewing.checklistId, viewing.ownerUserId]);

  const removeCustomItem = useCallback(async (id: string) => {
    if (!canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
    if (isDemoMode()) {
      demoRemoveCustomItem(id);
      await refreshAccount();
      return;
    }
    const userId = sessionRef.current?.user.id;
    if (!userId) return;
    const ownerUserId = viewing.ownerUserId || userId;
    setCustomItems((prev) => prev.filter((item) => item.id !== id));
    setProgress((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const ops = await listOps(userId);
    const unsent = ops.find((op) => op.kind === "custom_create" && op.itemId === id);
    for (const op of ops) {
      if (op.itemId === id && op.kind !== "custom_delete") await deleteOp(op.key);
    }
    if (!unsent) {
      await queueEdit({
        ownerUserId,
        checklistId: viewing.checklistId,
        kind: "custom_delete",
        itemId: id,
        editedAt: new Date().toISOString(),
      });
    }
    await syncNow();
  }, [canEdit, queueEdit, refreshAccount, syncNow, viewing.checklistId, viewing.ownerUserId]);

  const renameDevice = useCallback(async (id: string, nickname: string) => {
    if (isDemoMode()) demoRenameDevice(id, nickname);
    else await supabase.from("devices").update({ nickname: nickname.slice(0, 40) }).eq("id", id);
    await refreshAccount();
  }, [refreshAccount]);

  const removeDevice = useCallback(async (id: string) => {
    if (isDemoMode()) {
      demoRemoveDevice(id);
      await refreshAccount();
      return;
    }
    const { error } = await supabase.rpc("remove_device", { p_device_id: id });
    if (error) throw new Error("Could not remove that device. Check your connection and try again.");
    if (id === currentDevice?.id) {
      await signOut();
      return;
    }
    await refreshAccount();
  }, [currentDevice?.id, refreshAccount, signOut]);

  const setPreferredState = useCallback(async (code: string) => {
    if (isDemoMode()) {
      demoSetPreferredState(code);
      await refreshAccount();
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ preferred_state: code }).eq("id", user.id);
    await refreshAccount();
  }, [refreshAccount]);

  const updateProfile = useCallback(async (patch: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  }) => {
    if (isDemoMode()) {
      demoUpdateProfile(patch);
      await refreshAccount();
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const next = { ...patch };
    if (patch.first_name !== undefined || patch.last_name !== undefined) {
      next.full_name = [patch.first_name, patch.last_name].filter(Boolean).join(" ") || patch.full_name;
    }
    const { error } = await supabase.from("profiles").update(next).eq("id", user.id);
    if (error) throw error;
    await refreshAccount();
  }, [refreshAccount]);

  const uploadAvatar = useCallback(async (file: File) => {
    const blob = await compressAvatar(file);
    if (isDemoMode()) {
      demoUpdateProfile({ avatar_url: await blobToDataUrl(blob) });
      await refreshAccount();
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in to upload a photo.");
    const folder = user.id;
    const { data: existing } = await supabase.storage.from("avatars").list(folder);
    if (existing?.length) {
      await supabase.storage.from("avatars").remove(existing.map((item) => `${folder}/${item.name}`));
    }
    const path = `${folder}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` })
      .eq("id", user.id);
    if (error) throw error;
    await refreshAccount();
  }, [refreshAccount]);

  const switchChecklist = useCallback(async (kind: ViewingKind, checklistId?: string | null) => {
    storeView({ kind, checklistId: checklistId ?? null });
    if (isDemoMode()) demoSwitchView(kind, checklistId);
    await refreshAccount();
  }, [refreshAccount]);

  const setChecklistPermission = useCallback(async (checklistId: string, granteeUserId: string, permission: ChecklistPermission) => {
    if (isDemoMode()) {
      demoSetPermission(checklistId, permission);
      await refreshAccount();
      return;
    }
    const { error } = await supabase.rpc("set_checklist_permission", {
      p_checklist_id: checklistId,
      p_grantee: granteeUserId,
      p_permission: permission,
    });
    if (error) throw error;
    await refreshAccount();
  }, [refreshAccount]);

  const revokeChecklistAccess = useCallback(async (checklistId: string, granteeUserId?: string) => {
    if (isDemoMode()) {
      demoRevokeAccess(checklistId);
      await refreshAccount();
      return;
    }
    if (!granteeUserId) return;
    const { error } = await supabase.rpc("revoke_checklist_permission", {
      p_checklist_id: checklistId,
      p_grantee: granteeUserId,
    });
    if (error) throw error;
    await refreshAccount();
  }, [refreshAccount]);

  const inviteFamilyMember = useCallback(async (
    firstName: string,
    lastName: string,
    email: string,
    checklistId?: string,
    permission?: ChecklistPermission,
  ): Promise<FamilyInviteResult> => {
    if (isDemoMode()) {
      demoInviteMember(firstName, lastName, email);
      await refreshAccount();
      return { checklistId: checklistId || "", email, firstName, emailSent: true, inviteUrl: "" };
    }
    if (!session?.user.id) throw new Error("Sign in required.");
    const result = await invokeFunction<FamilyInviteResult>("family-invite", {
      action: "send",
      checklistId,
      firstName,
      lastName,
      email,
      permission,
    });
    await refreshAccount();
    return result;
  }, [refreshAccount, session?.user.id]);

  const setFamilyAccess = useCallback(async (checklistId: string, permission: ChecklistPermission) => {
    if (isDemoMode()) return;
    const { error } = await supabase.rpc("set_family_permissions", {
      p_grants: [{ checklistId, permission }],
    });
    if (error) throw error;
    await refreshAccount();
  }, [refreshAccount]);

  const resendInvite = useCallback(async (checklistId: string): Promise<FamilyInviteResult> => {
    if (isDemoMode()) {
      return { checklistId, email: "", firstName: "", emailSent: true, inviteUrl: "" };
    }
    return invokeFunction<FamilyInviteResult>("family-invite", { action: "resend", checklistId });
  }, []);

  const cancelInvitation = useCallback(async (checklistId: string) => {
    if (isDemoMode()) {
      demoCancelInvitation(checklistId);
      await refreshAccount();
      return;
    }
    await invokeFunction("family-invite", { action: "cancel", checklistId });
    await refreshAccount();
  }, [refreshAccount]);

  const vault = hasSurvivalVault(profile?.plan, planGroup?.hasSharedHousehold);

  const value = useMemo<AppState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      catalog,
      progress,
      contacts,
      devices,
      customItems,
      products,
      safety,
      currentDevice,
      deviceLimitReached,
      sync,
      online,
      loading,
      demoMode: isDemoMode(),
      viewing: canEdit === viewing.canEdit ? viewing : { ...viewing, canEdit },
      myChecklist,
      connectedChecklists,
      familyMembers,
      invitations,
      planGroup,
      hasSurvivalVault: vault,
      accessMode: mode,
      offline,
      prepareOffline,
      retrySync,
      discardChange,
      saveProgress,
      saveProgressMany,
      refreshAccount,
      signIn,
      changePassword,
      signOut,
      addContact,
      removeContact,
      addCustomItem,
      removeCustomItem,
      renameDevice,
      removeDevice,
      setPreferredState,
      updateProfile,
      uploadAvatar,
      switchChecklist,
      setChecklistPermission,
      revokeChecklistAccess,
      inviteFamilyMember,
      setFamilyAccess,
      resendInvite,
      cancelInvitation,
    }),
    [
      session,
      profile,
      catalog,
      progress,
      contacts,
      devices,
      customItems,
      products,
      safety,
      currentDevice,
      deviceLimitReached,
      sync,
      online,
      loading,
      viewing,
      canEdit,
      myChecklist,
      connectedChecklists,
      familyMembers,
      invitations,
      planGroup,
      vault,
      mode,
      offline,
      prepareOffline,
      retrySync,
      discardChange,
      saveProgress,
      saveProgressMany,
      refreshAccount,
      signIn,
      changePassword,
      signOut,
      addContact,
      removeContact,
      addCustomItem,
      removeCustomItem,
      renameDevice,
      removeDevice,
      setPreferredState,
      updateProfile,
      uploadAvatar,
      switchChecklist,
      setChecklistPermission,
      revokeChecklistAccess,
      inviteFamilyMember,
      setFamilyAccess,
      resendInvite,
      cancelInvitation,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {signOutPrompt ? (
        <ConfirmDialog
          title="Some changes have not synced yet"
          body={
            signOutPrompt.count === 1
              ? "1 change is saved on this device but not on your account yet. If you sign out, it stays on this device and syncs the next time you sign in here with this account."
              : `${signOutPrompt.count} changes are saved on this device but not on your account yet. If you sign out, they stay on this device and sync the next time you sign in here with this account.`
          }
          confirmLabel="Sign out"
          cancelLabel="Stay signed in"
          onClose={() => signOutPrompt.resolve(false)}
          onConfirm={() => signOutPrompt.resolve(true)}
        />
      ) : null}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

const SESSION_TIMEOUT_MS = 5000;

/** An expired sign-in makes supabase-js retry the token refresh for up to 30 seconds while offline; never wait that long. */
async function liveSession(): Promise<{ session: Session | null; unreachable: boolean }> {
  if (!navigator.onLine) return { session: null, unreachable: true };
  let timer = 0;
  const timeout = new Promise<{ session: null; unreachable: true }>((resolve) => {
    timer = window.setTimeout(() => resolve({ session: null, unreachable: true }), SESSION_TIMEOUT_MS);
  });
  const lookup = supabase.auth
    .getSession()
    .then(({ data, error }) => ({ session: data.session, unreachable: isNetworkError(error) }))
    .catch((error: unknown) => ({ session: null, unreachable: isNetworkError(error) }));
  const result = await Promise.race([lookup, timeout]);
  window.clearTimeout(timer);
  return result;
}

function isNetworkError(error: unknown) {
  if (!error) return false;
  const err = error as { name?: string; message?: string; code?: string };
  if (err.name === "AuthRetryableFetchError") return true;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(err.message || "");
}

function toAccessSnapshot(data: unknown): AccessSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { plan?: string; vault?: boolean; access_ends_at?: string | null; server_time?: string };
  return {
    plan: row.plan || "none",
    vault: Boolean(row.vault),
    accessEndsAt: row.access_ends_at ?? null,
    serverTime: row.server_time || new Date().toISOString(),
  };
}

/** Edits saved on this device but not yet on the account still show after a reload. */
function overlayQueue(
  ops: QueuedOp[],
  ownerId: string,
  progress: Record<string, ProgressRow>,
  customRows: CustomChecklistItem[],
) {
  const next = { ...progress };
  let custom = [...customRows];
  for (const op of ops) {
    if (op.kind === "custom_create" && op.ownerUserId === ownerId && !custom.some((item) => item.id === op.itemId)) {
      custom.push({
        id: op.itemId,
        user_id: ownerId,
        section_id: op.sectionId || "",
        text: op.text || "",
        description: op.description ?? null,
        sort_order: 1000 + custom.length,
        checked: false,
        note: "",
        created_at: op.editedAt,
        updated_at: op.editedAt,
      });
    }
  }
  for (const op of ops) {
    if (op.kind === "progress" && op.ownerUserId === ownerId) {
      next[op.itemId] = {
        id: next[op.itemId]?.id || op.itemId,
        user_id: ownerId,
        checklist_item_id: op.itemId,
        checked: Boolean(op.checked),
        note: op.note || "",
        updated_by_device_id: next[op.itemId]?.updated_by_device_id || null,
        updated_at: op.editedAt,
      };
    } else if (op.kind === "custom_progress") {
      custom = custom.map((item) =>
        item.id === op.itemId ? { ...item, checked: Boolean(op.checked), note: op.note || "", updated_at: op.editedAt } : item,
      );
    } else if (op.kind === "custom_delete") {
      custom = custom.filter((item) => item.id !== op.itemId);
      delete next[op.itemId];
    }
  }
  return { progress: mergeCustomProgress(next, custom), customItems: custom };
}

type SendResult =
  | { kind: "offline" }
  | { kind: "failed"; message: string; blocked: boolean; stop: boolean }
  | { kind: "ok"; conflict: boolean; progress?: ProgressRow; custom?: CustomChecklistItem; removed?: boolean };

function describeSyncError(message: string): SendResult {
  const kept = "It is still saved on this device.";
  if (message.includes("DEVICE_NOT_REGISTERED")) {
    return {
      kind: "failed",
      blocked: true,
      stop: true,
      message: `This device is not one of the registered devices on your account. ${kept} Open My Devices to remove a device you no longer use, then tap Try again.`,
    };
  }
  if (message.includes("ACCESS_ENDED") || message.includes("NO_ENTITLEMENT")) {
    return {
      kind: "failed",
      blocked: true,
      stop: true,
      message: `Your plan is not active, so this change cannot be saved to your account. ${kept} Renew your plan, then tap Try again.`,
    };
  }
  if (message.includes("CHECKLIST_VIEW_ONLY")) {
    return { kind: "failed", blocked: true, stop: false, message: `You no longer have permission to edit this checklist. ${kept}` };
  }
  if (message.includes("FULL_SYSTEM_REQUIRED")) {
    return { kind: "failed", blocked: true, stop: false, message: `This list is part of Survival Vault. ${kept}` };
  }
  if (message.includes("ITEM_LIMIT_REACHED")) {
    return { kind: "failed", blocked: true, stop: false, message: `This section already has 5 custom items on your account. ${kept}` };
  }
  if (/jwt|token/i.test(message)) return { kind: "offline" };
  return { kind: "failed", blocked: false, stop: false, message: `This change has not synced yet. ${kept} We will keep trying.` };
}

async function sendOp(op: QueuedOp, token: string): Promise<SendResult> {
  try {
    if (op.kind === "progress") {
      const { data, error } = await supabase.rpc("save_progress", {
        p_item_id: op.itemId,
        p_checked: Boolean(op.checked),
        p_note: op.note || "",
        p_owner_user_id: op.ownerUserId,
        p_edited_at: op.editedAt,
        p_device_token: token,
      });
      if (error) return isNetworkError(error) ? { kind: "offline" } : describeSyncError(error.message);
      const out = data as { applied: boolean; row: ProgressRow };
      return { kind: "ok", conflict: !out.applied, progress: out.row };
    }
    if (op.kind === "custom_progress") {
      const { data, error } = await supabase.rpc("save_custom_progress", {
        p_item_id: op.itemId,
        p_checked: Boolean(op.checked),
        p_note: op.note || "",
        p_edited_at: op.editedAt,
        p_device_token: token,
      });
      if (error) return isNetworkError(error) ? { kind: "offline" } : describeSyncError(error.message);
      const out = data as { applied: boolean; row?: CustomChecklistItem; missing?: boolean };
      if (out.missing) return { kind: "ok", conflict: true, removed: true };
      return { kind: "ok", conflict: !out.applied, custom: out.row };
    }
    if (op.kind === "custom_create") {
      const { data, error } = await supabase.rpc("create_custom_item", {
        p_id: op.itemId,
        p_section_id: op.sectionId,
        p_text: op.text || "",
        p_description: op.description ?? null,
        p_owner_user_id: op.ownerUserId,
        p_device_token: token,
      });
      if (error) return isNetworkError(error) ? { kind: "offline" } : describeSyncError(error.message);
      return { kind: "ok", conflict: false, custom: data as CustomChecklistItem };
    }
    const { error } = await supabase.rpc("delete_custom_item", { p_item_id: op.itemId, p_device_token: token });
    if (error) return isNetworkError(error) ? { kind: "offline" } : describeSyncError(error.message);
    return { kind: "ok", conflict: false, removed: true };
  } catch (err) {
    return isNetworkError(err) || !navigator.onLine ? { kind: "offline" } : describeSyncError(String(err));
  }
}

/** Keeps the device copy current so a reload while offline shows what the account has. */
function applySyncedRow(op: QueuedOp, result: SendResult, snapshot: Snapshot | null) {
  if (!snapshot || result.kind !== "ok") return;
  const ownerOf = (id: string): OwnerData => {
    snapshot.owners[id] = snapshot.owners[id] || { progress: {}, customItems: [], savedAt: snapshot.savedAt };
    return snapshot.owners[id];
  };
  if (result.progress) {
    ownerOf(result.progress.user_id).progress[result.progress.checklist_item_id] = result.progress;
  }
  if (result.custom) {
    const owner = ownerOf(result.custom.user_id);
    const row = result.custom;
    owner.customItems = owner.customItems.some((item) => item.id === row.id)
      ? owner.customItems.map((item) => (item.id === row.id ? row : item))
      : [...owner.customItems, row];
  }
  if (result.removed) {
    for (const owner of Object.values(snapshot.owners)) {
      owner.customItems = owner.customItems.filter((item) => item.id !== op.itemId);
    }
  }
}

function isProgressRow(value: unknown): value is ProgressRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ProgressRow;
  return Boolean(row.checklist_item_id) && typeof row.checked === "boolean";
}

function newerProgress(a: ProgressRow, b: ProgressRow) {
  return new Date(a.updated_at).getTime() >= new Date(b.updated_at).getTime() ? a : b;
}

function mergeServerProgress(server: Record<string, ProgressRow>, pending: Record<string, ProgressRow>) {
  const next = { ...server };
  for (const [id, local] of Object.entries(pending)) {
    const remote = next[id];
    if (!remote || newerProgress(local, remote) === local) {
      next[id] = local;
    } else if (remote.checked === local.checked && remote.note === local.note) {
      delete pending[id];
      next[id] = remote;
    }
  }
  return next;
}

function mergeCustomProgress(progress: Record<string, ProgressRow>, customItems: CustomChecklistItem[]) {
  const next = { ...progress };
  for (const item of customItems) {
    next[item.id] = {
      id: next[item.id]?.id || item.id,
      user_id: item.user_id,
      checklist_item_id: item.id,
      checked: item.checked,
      note: item.note,
      updated_by_device_id: next[item.id]?.updated_by_device_id || null,
      updated_at: item.updated_at,
    };
  }
  return next;
}

function grantDemoPreview(profile: Profile | null, family: LiveFamily): { profile: Profile | null; family: LiveFamily } {
  if (!profile || profile.email?.trim().toLowerCase() !== DEMO_PREVIEW_EMAIL) return { profile, family };
  const displayName = personName(profile);
  const source = family.members.find((member) => member.permission === "own") || family.mine;
  const mine = source
    ? {
        ...source,
        displayName,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
      }
    : null;
  return {
    profile: {
      ...profile,
      plan: "core",
      device_limit: Math.max(profile.device_limit || 0, 2),
    },
    family: {
      ...family,
      mine,
      connected: [],
      members: mine ? [{ ...mine, permission: "own", pending: false }] : [],
      group: {
        id: family.group?.id || profile.id,
        name: family.group?.name ?? null,
        createdBy: family.group?.createdBy || profile.id,
        hasSharedHousehold: true,
      },
    },
  };
}

function normalizeProfile(row: Profile | null): Profile | null {
  if (!row) return null;
  const first = row.first_name ?? personName(row).split(/\s+/)[0] ?? null;
  const last = row.last_name ?? null;
  return {
    ...row,
    first_name: first,
    last_name: last,
    display_name: row.display_name ?? first,
    phone: row.phone ?? null,
    avatar_url: row.avatar_url ?? null,
    custom_item_bonus: row.custom_item_bonus ?? 0,
  };
}

function readStoredView(): { kind: ViewingKind; checklistId: string | null } {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (raw) return JSON.parse(raw) as { kind: ViewingKind; checklistId: string | null };
  } catch {
    /* ignore */
  }
  return { kind: "personal", checklistId: null };
}

function storeView(view: { kind: ViewingKind; checklistId: string | null }) {
  sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
}

type LiveFamily = {
  mine: PersonalChecklist | null;
  connected: ConnectedChecklist[];
  members: ConnectedChecklist[];
  invitations: FamilyInvitation[];
  group: PlanGroup | null;
};

async function loadLiveFamily(userId: string, profile: Profile | null): Promise<LiveFamily> {
  const lists = await supabase.from("personal_checklists").select("*");
  if (lists.error) {
    return synthesizeFamily(userId, profile);
  }
  const rows = (lists.data || []) as Array<Record<string, string | null>>;
  const mapped = rows
    .map(mapChecklistRow)
    .filter((row) => Boolean(row.ownerUserId || row.purchasedByUserId))
    .map((row) => (row.ownerUserId === userId ? withOwnName(row, profile) : row));
  const mine = mapped.find((row) => row.ownerUserId === userId && row.status === "active") || null;
  const perms = await supabase.from("checklist_permissions").select("*").is("revoked_at", null);
  const permRows = (perms.data || []) as Array<{ checklist_id: string; grantee_user_id: string; permission: ChecklistPermission }>;
  const myGrants = permRows.filter((p) => p.grantee_user_id === userId);
  const connected: ConnectedChecklist[] = mapped
    .filter((row) => row.ownerUserId && row.ownerUserId !== userId && row.status !== "cancelled")
    .map((row) => {
      const grant = myGrants.find((p) => p.checklist_id === row.id);
      const theirAccess = mine
        ? permRows.find((p) => p.checklist_id === mine.id && p.grantee_user_id === row.ownerUserId)
        : undefined;
      return {
        ...row,
        permission: grant?.permission || "view",
        pending: row.status === "pending_claim",
        sharedWithMe: Boolean(grant),
        accessToMine: theirAccess?.permission ?? null,
      };
    });
  const seatGrantRows = mine
    ? (((await supabase.from("checklist_seat_grants").select("grantee_checklist_id, permission").eq("checklist_id", mine.id))
        .data || []) as Array<{ grantee_checklist_id: string; permission: ChecklistPermission }>)
    : [];
  const membership = await supabase
    .from("plan_group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at")
    .limit(1)
    .maybeSingle();
  const groupQuery = membership.data?.group_id
    ? supabase.from("plan_groups").select("*").eq("id", membership.data.group_id).maybeSingle()
    : supabase.from("plan_groups").select("*").eq("created_by", userId).order("created_at").limit(1).maybeSingle();
  const groupRes = await groupQuery;
  const groupRow = groupRes.data as { id: string; name: string | null; created_by: string; has_shared_household: boolean } | null;
  const group: PlanGroup | null = groupRow
    ? { id: groupRow.id, name: groupRow.name, createdBy: groupRow.created_by, hasSharedHousehold: groupRow.has_shared_household }
    : null;
  const inv = await supabase.from("checklist_invitations").select("*").eq("status", "pending");
  const invitations: FamilyInvitation[] = ((inv.data || []) as Array<Record<string, string>>).map((row) => ({
    id: row.id,
    checklistId: row.checklist_id,
    invitedEmail: row.invited_email,
    invitedName: row.invited_name,
    status: "pending",
    createdAt: row.created_at,
  }));
  const seats: ConnectedChecklist[] = mapped
    .filter((row) => !row.ownerUserId && row.purchasedByUserId === userId && row.status === "pending_claim")
    .map((row) => ({
      ...row,
      displayName: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Open seat",
      permission: "view" as const,
      pending: true,
      accessToMine: seatGrantRows.find((g) => g.grantee_checklist_id === row.id)?.permission ?? null,
    }))
    .sort((a, b) => Number(Boolean(b.email)) - Number(Boolean(a.email)));
  const members: ConnectedChecklist[] = [
    ...(mine ? [{ ...mine, permission: "own" as const, pending: false }] : []),
    ...connected,
    ...seats,
  ];
  return { mine, connected, members, invitations, group };
}

function mapChecklistRow(row: Record<string, string | null>): PersonalChecklist {
  const first = row.invited_first_name;
  const last = row.invited_last_name;
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    ownerUserId: row.owner_user_id,
    purchasedByUserId: row.purchased_by_user_id,
    status: (row.status as PersonalChecklist["status"]) || "active",
    firstName: first,
    lastName: last,
    email: row.invited_email,
    displayName: [first, last].filter(Boolean).join(" ") || "Family member",
    avatarUrl: null,
    accessEndsAt: row.access_ends_at ?? null,
  };
}

function withOwnName(row: PersonalChecklist, profile: Profile | null): PersonalChecklist {
  if (!profile || row.firstName || row.lastName) return row;
  const first = profile.first_name || null;
  const last = profile.last_name || null;
  const displayName = [first, last].filter(Boolean).join(" ") || profile.display_name || profile.full_name || row.displayName;
  return { ...row, firstName: first, lastName: last, displayName };
}

function synthesizeFamily(userId: string, profile: Profile | null): LiveFamily {
  if (!profile || profile.plan === "none") {
    return { mine: null, connected: [], members: [], invitations: [], group: null };
  }
  const mine: PersonalChecklist = {
    id: userId,
    publicId: `SPL-${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    ownerUserId: userId,
    purchasedByUserId: userId,
    status: "active",
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    displayName: personName(profile),
    avatarUrl: profile.avatar_url,
  };
  return {
    mine,
    connected: [],
    members: [{ ...mine, permission: "own", pending: false }],
    invitations: [],
    group: {
      id: userId,
      name: null,
      createdBy: userId,
      hasSharedHousehold: profile.plan === "full",
    },
  };
}

function resolveViewing(
  stored: { kind: ViewingKind; checklistId: string | null },
  family: LiveFamily,
  profile: Profile | null,
): ViewingContext {
  if (stored.kind === "household" && hasSurvivalVault(profile?.plan, family.group?.hasSharedHousehold)) {
    return {
      kind: "household",
      checklistId: null,
      ownerUserId: family.group?.createdBy || profile?.id || null,
      publicId: null,
      title: "Survival Vault",
      ownerName: "Survival Vault",
      avatarUrl: null,
      permission: "edit",
      isOwn: false,
      canEdit: true,
    };
  }
  const fromMembers = family.members.find((m) => m.id === stored.checklistId) || family.members.find((m) => m.permission === "own");
  const target: ConnectedChecklist | null = fromMembers || (family.mine ? { ...family.mine, permission: "own", pending: false } : null);
  const name = target?.displayName || personName(profile);
  const isOwn = !target || target.permission === "own" || target.ownerUserId === profile?.id;
  const permission = isOwn ? "own" : target.permission === "edit" ? "edit" : "view";
  return {
    kind: "personal",
    checklistId: target?.id || null,
    ownerUserId: target?.ownerUserId || profile?.id || null,
    publicId: target?.publicId || null,
    title: checklistTitle(name),
    ownerName: name,
    avatarUrl: target?.avatarUrl || profile?.avatar_url || null,
    permission,
    isOwn,
    canEdit: permission !== "view",
  };
}
