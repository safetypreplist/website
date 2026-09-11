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
import { supabase } from "../lib/supabase";
import {
  demoAddContact,
  demoAddCustomItem,
  demoCancelInvitation,
  demoCatalog,
  demoInviteMember,
  demoRemoveContact,
  demoRemoveCustomItem,
  demoRemoveDevice,
  demoRenameDevice,
  demoRevokeAccess,
  demoSaveCustomProgress,
  demoSaveProgress,
  demoSession,
  demoSetPermission,
  demoSetPreferredState,
  demoSignIn,
  demoSignOut,
  demoSignedIn,
  demoSwitchView,
  demoUpdateProfile,
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
import { checklistTitle, generatePublicChecklistId, personName } from "../lib/identity";
import { hasSurvivalVault } from "../lib/plan";
import { clearQueueItem, enqueueProgress, isOnline, readQueue } from "../lib/offline";
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
import { ITEM_LIMIT_ERROR } from "../lib/customItems";

type SyncState = "idle" | "saving" | "saved" | "waiting" | "error";
const VIEW_KEY = "spl.viewing.v1";

type Catalog = {
  systems: ChecklistSystem[];
  sections: ChecklistSection[];
  items: ChecklistItem[];
};

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
  videos: VideoResource[];
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
  saveProgress: (itemId: string, checked: boolean, note: string) => Promise<void>;
  refreshAccount: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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
  inviteFamilyMember: (firstName: string, lastName: string, email: string) => Promise<void>;
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
  const [videos, setVideos] = useState<VideoResource[]>([]);
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
  const refreshGen = useRef(0);
  const registeredDeviceUser = useRef<string | null>(null);
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
      setVideos(data.videos);
      setSafety(data.safety);
      return;
    }
    const [systems, sections, items, productRows, videoRows, safetyRows] = await Promise.all([
      supabase.from("checklist_systems").select("*").order("sort_order"),
      supabase.from("checklist_sections").select("*").order("sort_order"),
      supabase.from("checklist_items").select("*").eq("active", true).order("sort_order"),
      supabase.from("products").select("*"),
      supabase.from("video_resources").select("*").order("sort_order"),
      supabase.from("safety_contacts").select("*").eq("active", true).order("sort_order"),
    ]);
    setCatalog({
      systems: (systems.data as ChecklistSystem[]) || [],
      sections: (sections.data as ChecklistSection[]) || [],
      items: (items.data as ChecklistItem[]) || [],
    });
    setProducts((productRows.data as Product[]) || []);
    setVideos((videoRows.data as VideoResource[]) || []);
    setSafety((safetyRows.data as SafetyContact[]) || []);
  }, []);

  const registerThisDevice = useCallback(async () => {
    const token = getOrCreateDeviceToken();
    const hash = await hashDeviceToken(token);
    const { data, error } = await supabase.rpc("register_device", {
      p_token_hash: hash,
      p_nickname: suggestedNickname(),
      p_description: guessDeviceDescription(),
    });
    if (error) {
      if (error.message?.includes("DEVICE_LIMIT_REACHED")) {
        setDeviceLimitReached(true);
        setCurrentDevice(null);
        return;
      }
      console.warn(error);
      return;
    }
    setDeviceLimitReached(false);
    setCurrentDevice(data as Device);
  }, []);

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
    const {
      data: { session: next },
    } = await supabase.auth.getSession();
    if (gen !== refreshGen.current) return;
    setSession(next);
    if (!next?.user) {
      pendingProgress.current = {};
      registeredDeviceUser.current = null;
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
    const [prof, cons, devs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", next.user.id).maybeSingle(),
      supabase.from("contacts").select("*").eq("user_id", next.user.id).order("created_at"),
      supabase.from("devices").select("*").eq("user_id", next.user.id).order("created_at"),
    ]);
    const nextProfile = normalizeProfile((prof.data as Profile) || null);
    const family = await loadLiveFamily(next.user.id, nextProfile);
    const stored = readStoredView();
    const resolved = resolveViewing(stored, family, nextProfile);
    const ownerId = resolved.kind === "household" ? family.group?.createdBy || next.user.id : resolved.ownerUserId || next.user.id;
    const [prog, custom] = await Promise.all([
      supabase.from("checklist_progress").select("*").eq("user_id", ownerId),
      supabase.from("custom_checklist_items").select("*").eq("user_id", ownerId).order("sort_order"),
    ]);
    if (gen !== refreshGen.current) return;
    const customRows = custom.error ? [] : ((custom.data as CustomChecklistItem[]) || []);
    const map: Record<string, ProgressRow> = {};
    if (!prog.error) {
      for (const row of (prog.data as ProgressRow[]) || []) {
        map[row.checklist_item_id] = row;
      }
    }
    setProfile(nextProfile);
    if (!cons.error) setContacts((cons.data as Contact[]) || []);
    if (!devs.error) setDevices((devs.data as Device[]) || []);
    setMyChecklist(family.mine);
    setConnectedChecklists(family.connected);
    setFamilyMembers(family.members);
    setInvitations(family.invitations);
    setPlanGroup(family.group);
    setViewing(resolved);
    if (!custom.error) setCustomItems(customRows);
    if (!prog.error) {
      setProgress(mergeCustomProgress(mergeServerProgress(map, pendingProgress.current), customRows));
    }
    if (nextProfile && nextProfile.plan !== "none") {
      if (registeredDeviceUser.current !== next.user.id) {
        await registerThisDevice();
        registeredDeviceUser.current = next.user.id;
      }
    } else {
      registeredDeviceUser.current = null;
      setDeviceLimitReached(false);
    }
  }, [registerThisDevice]);

  useEffect(() => {
    let ignore = false;
    async function boot() {
      await loadPublic();
      await refreshAccount();
      if (!ignore) setLoading(false);
    }
    void boot();
    if (isDemoMode()) {
      return () => {
        ignore = true;
      };
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      void refreshAccount();
    });
    return () => {
      ignore = true;
      data.subscription.unsubscribe();
    };
  }, [loadPublic, refreshAccount]);

  useEffect(() => {
    if (isDemoMode() || !session?.user) return;
    const ownerId = viewing.ownerUserId || session.user.id;
    const userId = session.user.id;
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
  }, [session?.user, viewing.ownerUserId]);

  const flushQueue = useCallback(async () => {
    if (!online || !session?.user) return;
    const queue = readQueue();
    for (const item of queue) {
      const { error } = await supabase.rpc("upsert_progress", {
        p_item_id: item.itemId,
        p_checked: item.checked,
        p_note: item.note,
        p_device_id: item.deviceId,
        p_owner_user_id: viewing.ownerUserId || session.user.id,
      });
      if (!error) clearQueueItem(item.itemId);
    }
    if (readQueue().length === 0) setSync("saved");
  }, [online, session?.user, viewing.ownerUserId]);

  useEffect(() => {
    if (online) void flushQueue();
  }, [online, flushQueue]);

  const saveProgress = useCallback(
    (itemId: string, checked: boolean, note: string) => {
      const run = async () => {
        if (!viewing.canEdit) return;
        const clipped = note.slice(0, 100);
        const custom = customItems.some((item) => item.id === itemId);
        const optimistic: ProgressRow = {
          id: pendingProgress.current[itemId]?.id || itemId,
          user_id: viewing.ownerUserId || session?.user.id || "",
          checklist_item_id: itemId,
          checked,
          note: clipped,
          updated_by_device_id: currentDevice?.id || null,
          updated_at: new Date().toISOString(),
        };
        pendingProgress.current[itemId] = optimistic;
        setProgress((prev) => ({ ...prev, [itemId]: optimistic }));
        if (custom) {
          setCustomItems((prev) =>
            prev.map((item) =>
              item.id === itemId ? { ...item, checked, note: clipped, updated_at: optimistic.updated_at } : item,
            ),
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

        if (custom) {
          setSync("saving");
          const { data, error } = await supabase.rpc("save_custom_item_progress", {
            p_item_id: itemId,
            p_checked: checked,
            p_note: clipped,
          });
          if (error) {
            setSync("error");
            return;
          }
          const row = data as CustomChecklistItem;
          const saved: ProgressRow = {
            ...optimistic,
            checked: row.checked,
            note: row.note,
            updated_at: row.updated_at,
          };
          pendingProgress.current[itemId] = saved;
          setCustomItems((prev) => prev.map((item) => (item.id === itemId ? row : item)));
          setProgress((prev) => ({ ...prev, [itemId]: saved }));
          setSync("saved");
          return;
        }

        if (!online) {
          enqueueProgress({
            itemId,
            checked,
            note: clipped,
            deviceId: currentDevice?.id || null,
          });
          setSync("waiting");
          return;
        }

        setSync("saving");
        const { data, error } = await supabase.rpc("upsert_progress", {
          p_item_id: itemId,
          p_checked: checked,
          p_note: clipped,
          p_device_id: currentDevice?.id || null,
          p_owner_user_id: viewing.ownerUserId || session?.user.id,
        });
        if (error) {
          enqueueProgress({
            itemId,
            checked,
            note: clipped,
            deviceId: currentDevice?.id || null,
          });
          setSync("waiting");
          return;
        }
        const saved = data as ProgressRow;
        pendingProgress.current[itemId] = saved;
        clearQueueItem(itemId);
        setProgress((prev) => ({ ...prev, [itemId]: saved }));
        setSync("saved");
      };

      const next = (progressSaveChain.current[itemId] || Promise.resolve()).then(run, run);
      progressSaveChain.current[itemId] = next;
      return next;
    },
    [currentDevice?.id, customItems, online, session?.user.id, viewing.canEdit, viewing.ownerUserId],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    storeView({ kind: "personal", checklistId: null });
    if (isDemoMode()) {
      demoSignIn(email, password);
      await refreshAccount();
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshAccount();
  }, [refreshAccount]);

  const signOut = useCallback(async () => {
    if (isDemoMode()) demoSignOut();
    else await supabase.auth.signOut();
    sessionStorage.removeItem(VIEW_KEY);
    pendingProgress.current = {};
    registeredDeviceUser.current = null;
    refreshGen.current += 1;
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
    if (!viewing.canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
    if (isDemoMode()) {
      demoAddCustomItem(sectionId, text, description);
      await refreshAccount();
      return;
    }
    const { error } = await supabase.rpc("add_custom_item", {
      p_section_id: sectionId,
      p_text: text,
      p_description: description || null,
      p_owner_user_id: viewing.ownerUserId,
    });
    if (error) {
      throw new Error(error.message.includes("ITEM_LIMIT_REACHED") ? ITEM_LIMIT_ERROR : error.message);
    }
    await refreshAccount();
  }, [refreshAccount, viewing.canEdit, viewing.ownerUserId]);

  const removeCustomItem = useCallback(async (id: string) => {
    if (!viewing.canEdit) throw new Error("CHECKLIST_VIEW_ONLY");
    if (isDemoMode()) demoRemoveCustomItem(id);
    else await supabase.rpc("remove_custom_item", { p_item_id: id });
    await refreshAccount();
  }, [refreshAccount, viewing.canEdit]);

  const renameDevice = useCallback(async (id: string, nickname: string) => {
    if (isDemoMode()) demoRenameDevice(id, nickname);
    else await supabase.from("devices").update({ nickname: nickname.slice(0, 40) }).eq("id", id);
    await refreshAccount();
  }, [refreshAccount]);

  const removeDevice = useCallback(async (id: string) => {
    if (isDemoMode()) demoRemoveDevice(id);
    else await supabase.from("devices").delete().eq("id", id);
    await refreshAccount();
  }, [refreshAccount]);

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

  const inviteFamilyMember = useCallback(async (firstName: string, lastName: string, email: string) => {
    if (isDemoMode()) {
      demoInviteMember(firstName, lastName, email);
      await refreshAccount();
      return;
    }
    if (!session?.user.id) throw new Error("Sign in required.");
    const { data: seats } = await supabase
      .from("personal_checklists")
      .select("id")
      .eq("purchased_by_user_id", session.user.id)
      .eq("status", "pending_claim")
      .is("invited_email", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const seatId = seats?.[0]?.id;
    if (seatId) {
      const { error } = await supabase
        .from("personal_checklists")
        .update({
          invited_first_name: firstName,
          invited_last_name: lastName,
          invited_email: email,
        })
        .eq("id", seatId);
      if (error) throw error;
      await refreshAccount();
      return;
    }
    const { error } = await supabase.from("personal_checklists").insert({
      public_id: generatePublicChecklistId(),
      purchased_by_user_id: session.user.id,
      status: "pending_claim",
      invited_first_name: firstName,
      invited_last_name: lastName,
      invited_email: email,
    });
    if (error) throw error;
    await refreshAccount();
  }, [refreshAccount, session?.user.id]);

  const cancelInvitation = useCallback(async (checklistId: string) => {
    if (isDemoMode()) {
      demoCancelInvitation(checklistId);
      await refreshAccount();
      return;
    }
    await supabase.from("personal_checklists").update({ status: "cancelled" }).eq("id", checklistId);
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
      videos,
      safety,
      currentDevice,
      deviceLimitReached,
      sync,
      online,
      loading,
      demoMode: isDemoMode(),
      viewing,
      myChecklist,
      connectedChecklists,
      familyMembers,
      invitations,
      planGroup,
      hasSurvivalVault: vault,
      saveProgress,
      refreshAccount,
      signIn,
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
      videos,
      safety,
      currentDevice,
      deviceLimitReached,
      sync,
      online,
      loading,
      viewing,
      myChecklist,
      connectedChecklists,
      familyMembers,
      invitations,
      planGroup,
      vault,
      saveProgress,
      refreshAccount,
      signIn,
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
      cancelInvitation,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
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
    .filter((row) => Boolean(row.ownerUserId || row.purchasedByUserId));
  const mine = mapped.find((row) => row.ownerUserId === userId && row.status === "active") || null;
  const perms = await supabase.from("checklist_permissions").select("*").is("revoked_at", null);
  const permRows = (perms.data || []) as Array<{ checklist_id: string; grantee_user_id: string; permission: ChecklistPermission }>;
  const myGrants = permRows.filter((p) => p.grantee_user_id === userId);
  const connected: ConnectedChecklist[] = mapped
    .filter((row) => row.ownerUserId && row.ownerUserId !== userId && row.status !== "cancelled")
    .map((row) => {
      const grant = myGrants.find((p) => p.checklist_id === row.id);
      return {
        ...row,
        permission: grant?.permission || "view",
        pending: row.status === "pending_claim",
      };
    });
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
  const members: ConnectedChecklist[] = [
    ...(mine ? [{ ...mine, permission: "own" as const, pending: false }] : []),
    ...connected,
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
  };
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
