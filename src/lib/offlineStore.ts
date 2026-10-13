import type { Session } from "@supabase/supabase-js";
import type {
  ChecklistItem,
  ChecklistSection,
  ChecklistSystem,
  ConnectedChecklist,
  Contact,
  CustomChecklistItem,
  Device,
  FamilyInvitation,
  PersonalChecklist,
  PlanGroup,
  Profile,
  ProgressRow,
} from "../types";

const DB_NAME = "spl-offline";
const DB_VERSION = 1;
const SNAPSHOTS = "snapshots";
const QUEUE = "queue";
const LEGACY_QUEUE_KEY = "spl.offline.progress.v1";
const CLOCK_KEY = "spl.clock.floor";
const SIGNED_OUT_KEY = "spl.signedOut.reason";

export type OwnerData = {
  progress: Record<string, ProgressRow>;
  customItems: CustomChecklistItem[];
  savedAt: string;
};

export type AccessSnapshot = {
  plan: string;
  vault: boolean;
  accessEndsAt: string | null;
  serverTime: string;
};

export type Snapshot = {
  userId: string;
  savedAt: string;
  preparedAt: string | null;
  profile: Profile | null;
  catalog: { systems: ChecklistSystem[]; sections: ChecklistSection[]; items: ChecklistItem[] };
  family: {
    mine: PersonalChecklist | null;
    connected: ConnectedChecklist[];
    members: ConnectedChecklist[];
    invitations: FamilyInvitation[];
    group: PlanGroup | null;
  };
  contacts: Contact[];
  devices: Device[];
  currentDevice: Device | null;
  access: AccessSnapshot | null;
  owners: Record<string, OwnerData>;
};

export type OpKind = "progress" | "custom_progress" | "custom_create" | "custom_delete";

export type QueuedOp = {
  key: string;
  userId: string;
  ownerUserId: string;
  checklistId: string | null;
  kind: OpKind;
  itemId: string;
  checked?: boolean;
  note?: string;
  sectionId?: string;
  text?: string;
  description?: string | null;
  editedAt: string;
  attempts: number;
  lastError: string | null;
  blocked: boolean;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot store checklists for offline use."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS, { keyPath: "userId" });
      if (!db.objectStoreNames.contains(QUEUE)) {
        const store = db.createObjectStore(QUEUE, { keyPath: "key" });
        store.createIndex("userId", "userId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(request ? (request.result as T) : (undefined as T));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function readSnapshot(userId: string): Promise<Snapshot | null> {
  try {
    return ((await run<Snapshot | undefined>(SNAPSHOTS, "readonly", (s) => s.get(userId))) as Snapshot) || null;
  } catch {
    return null;
  }
}

export async function writeSnapshot(snapshot: Snapshot) {
  try {
    await run(SNAPSHOTS, "readwrite", (s) => s.put(snapshot));
    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

/** Personal data from other logins never stays readable on a shared device. Their unsynced edits are kept. */
export async function removeSnapshots(exceptUserId?: string) {
  try {
    const keys = (await run<IDBValidKey[]>(SNAPSHOTS, "readonly", (s) => s.getAllKeys())) || [];
    for (const key of keys) {
      if (key !== exceptUserId) await run(SNAPSHOTS, "readwrite", (s) => s.delete(key));
    }
  } catch {
    /* nothing stored */
  }
}

export async function listOps(userId: string): Promise<QueuedOp[]> {
  try {
    const rows = (await run<QueuedOp[]>(QUEUE, "readonly", (s) => s.index("userId").getAll(userId))) || [];
    const order: Record<OpKind, number> = { custom_create: 0, progress: 1, custom_progress: 1, custom_delete: 2 };
    return rows.sort((a, b) => order[a.kind] - order[b.kind] || a.editedAt.localeCompare(b.editedAt));
  } catch {
    return [];
  }
}

export async function putOp(op: QueuedOp) {
  await run(QUEUE, "readwrite", (s) => s.put(op));
}

export async function deleteOp(key: string) {
  await run(QUEUE, "readwrite", (s) => s.delete(key));
}

/** Removes or updates a sent edit, unless a newer edit to the same item replaced it meanwhile. */
export async function settleOp(sent: QueuedOp, next: QueuedOp | null) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE, "readwrite");
    const store = tx.objectStore(QUEUE);
    const request = store.get(sent.key);
    request.onsuccess = () => {
      const current = request.result as QueuedOp | undefined;
      if (!current || current.editedAt !== sent.editedAt) return;
      if (next) store.put(next);
      else store.delete(sent.key);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Edits waiting on this device for any login, shown on the sign-in page so nobody assumes they were lost. */
export async function countAllOps(): Promise<number> {
  try {
    return (await run<number>(QUEUE, "readonly", (s) => s.count())) || 0;
  } catch {
    return 0;
  }
}

export type SignedOutReason = "device_removed";

export function setSignedOutReason(reason: SignedOutReason) {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, reason);
  } catch {
    /* ignore */
  }
}

export function takeSignedOutReason(): SignedOutReason | null {
  try {
    const reason = sessionStorage.getItem(SIGNED_OUT_KEY);
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    return reason === "device_removed" ? reason : null;
  } catch {
    return null;
  }
}

export async function deleteOpsForUser(userId: string) {
  const ops = await listOps(userId);
  for (const op of ops) await deleteOp(op.key);
}

export function opKey(userId: string, kind: OpKind, itemId: string, ownerUserId: string) {
  return kind === "progress" ? `${userId}|${kind}|${ownerUserId}|${itemId}` : `${userId}|${kind}|${itemId}`;
}

/** Edits queued by the previous app version had no owner; they belonged to the signed-in user. */
export async function migrateLegacyQueue(userId: string) {
  let legacy: { itemId: string; checked: boolean; note: string; queuedAt: string }[] = [];
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_QUEUE_KEY) || "[]");
  } catch {
    legacy = [];
  }
  if (!legacy.length) return;
  for (const row of legacy) {
    await putOp({
      key: opKey(userId, "progress", row.itemId, userId),
      userId,
      ownerUserId: userId,
      checklistId: null,
      kind: "progress",
      itemId: row.itemId,
      checked: row.checked,
      note: row.note,
      editedAt: row.queuedAt || new Date().toISOString(),
      attempts: 0,
      lastError: null,
      blocked: false,
    });
  }
  localStorage.removeItem(LEGACY_QUEUE_KEY);
}

export async function remapQueuedItems(userId: string, ids: Map<string, string>) {
  if (!ids.size) return;
  for (const op of await listOps(userId)) {
    const next = ids.get(op.itemId);
    if (op.kind !== "progress" || !next) continue;
    await deleteOp(op.key);
    await putOp({ ...op, itemId: next, key: opKey(userId, op.kind, next, op.ownerUserId) });
  }
}

/** The session supabase-js stored on this device, readable without a network round trip. */
export function storedSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!/^sb-.+-auth-token$/.test(key)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || "null") as Session | null;
      if (parsed?.user?.id && parsed.refresh_token) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Signing out while offline cannot reach the server, but the login must still leave this device. */
export function forgetStoredSession() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (/^sb-.+-auth-token/.test(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Never earlier than the latest time this device has seen, so turning the clock back cannot extend access. */
export function trustedNow(serverTime?: string | null) {
  const stored = Number(localStorage.getItem(CLOCK_KEY) || 0);
  const server = serverTime ? Date.parse(serverTime) : 0;
  const now = Math.max(Date.now(), stored, Number.isFinite(server) ? server : 0);
  try {
    localStorage.setItem(CLOCK_KEY, String(now));
  } catch {
    /* ignore */
  }
  return now;
}

export type StorageStatus = { persisted: boolean; quotaMb: number | null; freeMb: number | null; low: boolean };

export async function prepareStorage(): Promise<StorageStatus> {
  let persisted = false;
  try {
    persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false;
  } catch {
    persisted = false;
  }
  let quotaMb: number | null = null;
  let freeMb: number | null = null;
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota != null) {
      quotaMb = Math.round(estimate.quota / 1048576);
      freeMb = Math.round((estimate.quota - (estimate.usage || 0)) / 1048576);
    }
  } catch {
    /* unsupported */
  }
  return { persisted, quotaMb, freeMb, low: freeMb != null && freeMb < 25 };
}

/** Older app versions cached account rows in the service worker; remove them. */
export async function clearLegacyCaches() {
  try {
    if ("caches" in window) {
      await caches.delete("spl-public-content");
      await caches.delete("spl-pages");
    }
  } catch {
    /* ignore */
  }
}
