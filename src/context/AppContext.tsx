import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type {
  ChecklistItem,
  ChecklistSection,
  ChecklistSystem,
  Contact,
  CustomChecklistItem,
  ProgressRow,
  SafetyContact,
  ViewingContext,
} from "../types";
import { isOnline } from "../lib/offline";
import {
  getLicense,
  isLicensed,
  refreshLocalLicenseProduct,
  type LicenseProduct,
} from "../lib/licenseClient";
import { loadCatalog } from "../lib/loadCatalog";
import {
  deleteContact as deleteLocalContact,
  deleteCustomItem as deleteLocalCustom,
  ensureLocalStore,
  loadContacts,
  loadCustomItems,
  loadProgress,
  newLocalId,
  saveContact,
  saveCustomItem,
  saveProgressMany,
  saveProgressRow,
} from "../lib/localStore";
import { supabase } from "../lib/supabase";
import { checklistTitle } from "../lib/identity";
import {
  loadLocalProfile,
  saveLocalProfile as persistLocalProfile,
  type LocalProfile as DeviceProfile,
  type LocalProfileInput,
} from "../lib/localProfile";

export type OfflineStatus = {
  pending: number;
  conflicts: number;
  usingSavedCopy: boolean;
  savedAt: string | null;
  preparedAt: string | null;
  issues: Array<{ key: string; message: string }>;
  storage: { low: boolean } | null;
};

type Catalog = {
  systems: ChecklistSystem[];
  sections: ChecklistSection[];
  items: ChecklistItem[];
};

type LocalProfile = {
  preferred_state: string | null;
  role: "customer" | "owner";
  plan: "core" | "full";
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type AppState = {
  session: Session | null;
  user: User | null;
  profile: LocalProfile;
  catalog: Catalog;
  progress: Record<string, ProgressRow>;
  contacts: Contact[];
  devices: [];
  customItems: CustomChecklistItem[];
  products: [];
  safety: SafetyContact[];
  currentDevice: null;
  deviceLimitReached: false;
  sync: "idle" | "saving" | "waiting" | "error";
  online: boolean;
  loading: boolean;
  demoMode: boolean;
  viewing: ViewingContext;
  myChecklist: null;
  connectedChecklists: [];
  familyMembers: [];
  invitations: [];
  planGroup: null;
  hasSurvivalVault: boolean;
  accessMode: "full";
  offline: OfflineStatus;
  prepareOffline: () => Promise<{ ok: true }>;
  turnOffOffline: () => Promise<void>;
  retrySync: () => Promise<void>;
  discardChange: (key: string) => Promise<void>;
  saveProgress: (itemId: string, checked: boolean, note: string) => Promise<void>;
  saveProgressMany: (updates: { itemId: string; checked: boolean; note: string }[]) => Promise<void>;
  refreshAccount: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ role: "customer" | "owner" | null }>;
  changePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  addContact: (name: string, phone: string, label: string) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  addCustomItem: (sectionId: string, text: string, description?: string | null) => Promise<void>;
  removeCustomItem: (id: string) => Promise<void>;
  renameDevice: () => Promise<void>;
  removeDevice: () => Promise<void>;
  setPreferredState: (code: string) => Promise<void>;
  localProfile: DeviceProfile;
  saveLocalProfile: (next: LocalProfileInput) => Promise<void>;
  updateProfile: () => Promise<void>;
  uploadAvatar: () => Promise<void>;
  switchChecklist: (kind: ViewingContext["kind"]) => Promise<void>;
  setChecklistPermission: () => Promise<void>;
  revokeChecklistAccess: () => Promise<void>;
  inviteFamilyMember: () => Promise<never>;
  setFamilyAccess: () => Promise<void>;
  resendInvite: () => Promise<never>;
  cancelInvitation: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

const emptyOffline: OfflineStatus = {
  pending: 0,
  conflicts: 0,
  usingSavedCopy: false,
  savedAt: null,
  preparedAt: null,
  issues: [],
  storage: null,
};

function viewingFromProfile(profile: DeviceProfile): ViewingContext {
  const name = profile.displayName.trim() || "My";
  return {
    kind: "personal",
    checklistId: "local",
    ownerUserId: "local",
    publicId: "local",
    title: checklistTitle(name),
    ownerName: name,
    avatarUrl: profile.avatarDataUrl,
    permission: "own",
    isOwn: true,
    canEdit: true,
  };
}

const PREFERRED_STATE_KEY = "spl.preferredState.v1";
const LOCAL_USER = "local";

function clipNote(note: string) {
  return note.slice(0, 100);
}

async function fetchProfileRole(userId: string): Promise<"customer" | "owner"> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "owner" ? "owner" : "customer";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>({ systems: [], sections: [], items: [] });
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customItems, setCustomItems] = useState<CustomChecklistItem[]>([]);
  const [safety, setSafety] = useState<SafetyContact[]>([]);
  const [online, setOnline] = useState(isOnline());
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<"customer" | "owner">("customer");
  const [sync, setSync] = useState<"idle" | "saving" | "waiting" | "error">("idle");
  const [localProfile, setLocalProfile] = useState<DeviceProfile>(() => loadLocalProfile());
  const [viewing, setViewing] = useState<ViewingContext>(() => viewingFromProfile(loadLocalProfile()));
  const [offline, setOffline] = useState<OfflineStatus>(emptyOffline);
  const [preferredState, setPreferredStateValue] = useState<string | null>(() => localStorage.getItem(PREFERRED_STATE_KEY));
  const [licenseProduct, setLicenseProduct] = useState<LicenseProduct | null>(() => getLicense()?.product ?? null);

  const hasSurvivalVault = licenseProduct === "pro";

  const refreshLocal = useCallback(async () => {
    await ensureLocalStore();
    const product = await refreshLocalLicenseProduct();
    setLicenseProduct(product ?? getLicense()?.product ?? null);
    const stillLicensed = isLicensed();
    if (stillLicensed) {
      const bundle = loadCatalog();
      setCatalog({ systems: bundle.systems, sections: bundle.sections, items: bundle.items });
      setSafety(bundle.safety);
    } else {
      setCatalog({ systems: [], sections: [], items: [] });
      setSafety([]);
    }
    const [nextProgress, nextCustoms, nextContacts] = await Promise.all([
      loadProgress(),
      loadCustomItems(),
      loadContacts(),
    ]);
    setProgress(nextProgress);
    setCustomItems(nextCustoms);
    setContacts(nextContacts);
    setOffline((prev) => ({
      ...prev,
      usingSavedCopy: !navigator.onLine,
      savedAt: new Date().toISOString(),
      preparedAt: prev.preparedAt || new Date().toISOString(),
    }));
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await refreshLocal();
      } finally {
        if (live) setLoading(false);
      }
    })();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      live = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refreshLocal]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!live) return;
      const next = data.session ?? null;
      setSession(next);
      if (next?.user?.id) {
        const nextRole = await fetchProfileRole(next.user.id);
        if (live) setRole(nextRole);
      } else {
        setRole("customer");
      }
      if (live) setAuthReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user?.id) {
        void fetchProfileRole(next.user.id).then((nextRole) => {
          if (live) setRole(nextRole);
        });
      } else {
        setRole("customer");
      }
    });

    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) return { role: null as "customer" | "owner" | null };
    const nextRole = await fetchProfileRole(userId);
    setSession(data.session);
    setRole(nextRole);
    if (nextRole !== "owner") {
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setRole("customer");
      throw new Error("This login is for administrators only.");
    }
    return { role: nextRole };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setRole("customer");
  }, []);

  const changePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const saveProgress = useCallback(async (itemId: string, checked: boolean, note: string) => {
    const now = new Date().toISOString();
    const row: ProgressRow = {
      id: progress[itemId]?.id || newLocalId("prog"),
      user_id: LOCAL_USER,
      checklist_item_id: itemId,
      checked,
      note: clipNote(note),
      updated_by_device_id: null,
      updated_at: now,
    };
    setProgress((prev) => ({ ...prev, [itemId]: row }));
    setSync("saving");
    try {
      await saveProgressRow(row);
      setSync("idle");
    } catch {
      setSync("error");
    }
  }, [progress]);

  const saveProgressManyFn = useCallback(async (updates: { itemId: string; checked: boolean; note: string }[]) => {
    const now = new Date().toISOString();
    const rows: ProgressRow[] = updates.map((update) => ({
      id: progress[update.itemId]?.id || newLocalId("prog"),
      user_id: LOCAL_USER,
      checklist_item_id: update.itemId,
      checked: update.checked,
      note: clipNote(update.note),
      updated_by_device_id: null,
      updated_at: now,
    }));
    setProgress((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.checklist_item_id] = row;
      return next;
    });
    setSync("saving");
    try {
      await saveProgressMany(rows);
      setSync("idle");
    } catch {
      setSync("error");
    }
  }, [progress]);

  const addContact = useCallback(async (name: string, phone: string, label: string) => {
    const now = new Date().toISOString();
    const contact: Contact = {
      id: newLocalId("contact"),
      user_id: LOCAL_USER,
      name: name.trim(),
      phone: phone.trim(),
      label: label.trim(),
      created_at: now,
      updated_at: now,
    };
    setContacts((prev) => [...prev, contact]);
    await saveContact(contact);
  }, []);

  const removeContact = useCallback(async (id: string) => {
    setContacts((prev) => prev.filter((row) => row.id !== id));
    await deleteLocalContact(id);
  }, []);

  const addCustomItem = useCallback(async (sectionId: string, text: string, description?: string | null) => {
    const now = new Date().toISOString();
    const item: CustomChecklistItem = {
      id: newLocalId("custom"),
      user_id: LOCAL_USER,
      section_id: sectionId,
      text: text.trim(),
      description: description?.trim() || null,
      sort_order: Date.now(),
      checked: false,
      note: "",
      created_at: now,
      updated_at: now,
    };
    setCustomItems((prev) => [...prev, item]);
    await saveCustomItem(item);
  }, []);

  const removeCustomItem = useCallback(async (id: string) => {
    setCustomItems((prev) => prev.filter((row) => row.id !== id));
    await deleteLocalCustom(id);
  }, []);

  const switchChecklist = useCallback(async (kind: ViewingContext["kind"]) => {
    setViewing((prev) => ({
      ...prev,
      kind,
      title: checklistTitle(prev.ownerName),
    }));
  }, []);

  const setPreferredState = useCallback(async (code: string) => {
    localStorage.setItem(PREFERRED_STATE_KEY, code);
    setPreferredStateValue(code);
  }, []);

  const saveLocalProfile = useCallback(
    async (next: LocalProfileInput) => {
      const saved = persistLocalProfile(next);
      setLocalProfile(saved);
      setViewing((prev) => ({
        ...viewingFromProfile(saved),
        kind: prev.kind,
      }));
      if (saved.location?.stateCode) {
        localStorage.setItem(PREFERRED_STATE_KEY, saved.location.stateCode);
        setPreferredStateValue(saved.location.stateCode);
      }
    },
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: {
        preferred_state: preferredState,
        role,
        plan: hasSurvivalVault ? "full" : "core",
        first_name: localProfile.firstName || null,
        last_name: localProfile.lastName || null,
        full_name: localProfile.displayName || null,
        display_name: localProfile.displayName || null,
        avatar_url: localProfile.avatarDataUrl,
      },
      catalog,
      progress,
      contacts,
      devices: [],
      customItems,
      products: [],
      safety,
      currentDevice: null,
      deviceLimitReached: false,
      sync,
      online,
      loading: loading || !authReady,
      demoMode: false,
      viewing,
      myChecklist: null,
      connectedChecklists: [],
      familyMembers: [],
      invitations: [],
      planGroup: null,
      hasSurvivalVault,
      accessMode: "full",
      offline,
      prepareOffline: async () => {
        setOffline((prev) => ({ ...prev, preparedAt: new Date().toISOString() }));
        return { ok: true };
      },
      turnOffOffline: async () => {
        setOffline((prev) => ({ ...prev, preparedAt: null }));
      },
      retrySync: async () => {
        await refreshLocal();
      },
      discardChange: async () => undefined,
      saveProgress,
      saveProgressMany: saveProgressManyFn,
      refreshAccount: refreshLocal,
      signIn,
      changePassword,
      signOut,
      addContact,
      removeContact,
      addCustomItem,
      removeCustomItem,
      renameDevice: async () => undefined,
      removeDevice: async () => undefined,
      setPreferredState,
      localProfile,
      saveLocalProfile,
      updateProfile: async () => undefined,
      uploadAvatar: async () => undefined,
      switchChecklist,
      setChecklistPermission: async () => undefined,
      revokeChecklistAccess: async () => undefined,
      inviteFamilyMember: async () => {
        throw new Error("Family plans are not available.");
      },
      setFamilyAccess: async () => undefined,
      resendInvite: async () => {
        throw new Error("Family plans are not available.");
      },
      cancelInvitation: async () => undefined,
    }),
    [
      session,
      preferredState,
      role,
      hasSurvivalVault,
      localProfile,
      catalog,
      progress,
      contacts,
      customItems,
      safety,
      sync,
      online,
      loading,
      authReady,
      viewing,
      offline,
      saveProgress,
      saveProgressManyFn,
      refreshLocal,
      signIn,
      changePassword,
      signOut,
      addContact,
      removeContact,
      addCustomItem,
      removeCustomItem,
      setPreferredState,
      saveLocalProfile,
      switchChecklist,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
