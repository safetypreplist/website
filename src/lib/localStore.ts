import type { Contact, CustomChecklistItem, ProgressRow } from "../types";
import { listAllSnapshots, type Snapshot } from "./offlineStore";

const DB_NAME = "spl-local";
const DB_VERSION = 1;
const STORE_PROGRESS = "progress";
const STORE_CUSTOM = "customItems";
const STORE_CONTACTS = "contacts";
const STORE_META = "meta";
const STORE_IMPORTS = "importedLists";

export type LocalProgress = ProgressRow;
export type LocalCustomItem = CustomChecklistItem;
export type LocalContact = Contact;

export type ImportedChecklist = {
  id: string;
  title: string;
  sharedBy: string;
  importedAt: string;
  items: Array<{ id: string; text: string; checked: boolean; note: string }>;
};

type MetaRow = { key: string; value: unknown };

let dbPromise: Promise<IDBDatabase> | null = null;
let migratePromise: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot store checklists offline."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS, { keyPath: "checklist_item_id" });
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOM)) {
        db.createObjectStore(STORE_CUSTOM, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
        db.createObjectStore(STORE_CONTACTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_IMPORTS)) {
        db.createObjectStore(STORE_IMPORTS, { keyPath: "id" });
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

async function getMeta<T>(key: string): Promise<T | null> {
  try {
    const row = (await run<MetaRow | undefined>(STORE_META, "readonly", (s) => s.get(key))) as MetaRow | undefined;
    return (row?.value as T) ?? null;
  } catch {
    return null;
  }
}

function mergeProgress(into: Record<string, ProgressRow>, rows: Record<string, ProgressRow>) {
  for (const [id, row] of Object.entries(rows)) {
    const existing = into[id];
    if (!existing || String(row.updated_at) > String(existing.updated_at)) into[id] = row;
  }
}

function mergeByUpdatedAt<T extends { id: string; updated_at: string }>(into: Map<string, T>, rows: T[]) {
  for (const row of rows) {
    const existing = into.get(row.id);
    if (!existing || row.updated_at > existing.updated_at) into.set(row.id, row);
  }
}

async function migrateFromOfflineStore() {
  const done = await getMeta<boolean>("migratedFromOffline");
  if (done) return;

  const snapshots: Snapshot[] = await listAllSnapshots();
  const progress: Record<string, ProgressRow> = {};
  const customs = new Map<string, CustomChecklistItem>();
  const contacts = new Map<string, Contact>();

  for (const snap of snapshots) {
    for (const owner of Object.values(snap.owners || {})) {
      mergeProgress(progress, owner.progress || {});
      mergeByUpdatedAt(customs, owner.customItems || []);
    }
    mergeByUpdatedAt(contacts, snap.contacts || []);
  }

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_PROGRESS, STORE_CUSTOM, STORE_CONTACTS, STORE_META], "readwrite");
    const progressStore = tx.objectStore(STORE_PROGRESS);
    const customStore = tx.objectStore(STORE_CUSTOM);
    const contactStore = tx.objectStore(STORE_CONTACTS);
    const metaStore = tx.objectStore(STORE_META);
    for (const row of Object.values(progress)) progressStore.put(row);
    for (const row of customs.values()) customStore.put(row);
    for (const row of contacts.values()) contactStore.put(row);
    metaStore.put({ key: "migratedFromOffline", value: true } satisfies MetaRow);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Ensures DB is open and offline snapshots have been migrated once. */
export async function ensureLocalStore() {
  if (!migratePromise) {
    migratePromise = migrateFromOfflineStore().catch((err) => {
      migratePromise = null;
      console.warn("localStore migration failed", err);
    });
  }
  await migratePromise;
  return openDb();
}

export async function loadProgress(): Promise<Record<string, ProgressRow>> {
  await ensureLocalStore();
  const rows = ((await run<ProgressRow[]>(STORE_PROGRESS, "readonly", (s) => s.getAll())) as ProgressRow[]) || [];
  const map: Record<string, ProgressRow> = {};
  for (const row of rows) map[row.checklist_item_id] = row;
  return map;
}

export async function saveProgressRow(row: ProgressRow) {
  await ensureLocalStore();
  await run(STORE_PROGRESS, "readwrite", (s) => s.put(row));
}

export async function saveProgressMany(rows: ProgressRow[]) {
  await ensureLocalStore();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PROGRESS, "readwrite");
    const store = tx.objectStore(STORE_PROGRESS);
    for (const row of rows) store.put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadCustomItems(): Promise<CustomChecklistItem[]> {
  await ensureLocalStore();
  return ((await run<CustomChecklistItem[]>(STORE_CUSTOM, "readonly", (s) => s.getAll())) as CustomChecklistItem[]) || [];
}

export async function saveCustomItem(item: CustomChecklistItem) {
  await ensureLocalStore();
  await run(STORE_CUSTOM, "readwrite", (s) => s.put(item));
}

export async function deleteCustomItem(id: string) {
  await ensureLocalStore();
  await run(STORE_CUSTOM, "readwrite", (s) => s.delete(id));
}

export async function loadContacts(): Promise<Contact[]> {
  await ensureLocalStore();
  const rows = ((await run<Contact[]>(STORE_CONTACTS, "readonly", (s) => s.getAll())) as Contact[]) || [];
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveContact(contact: Contact) {
  await ensureLocalStore();
  await run(STORE_CONTACTS, "readwrite", (s) => s.put(contact));
}

export async function deleteContact(id: string) {
  await ensureLocalStore();
  await run(STORE_CONTACTS, "readwrite", (s) => s.delete(id));
}

export async function loadImportedLists(): Promise<ImportedChecklist[]> {
  await ensureLocalStore();
  return ((await run<ImportedChecklist[]>(STORE_IMPORTS, "readonly", (s) => s.getAll())) as ImportedChecklist[]) || [];
}

export async function saveImportedList(list: ImportedChecklist) {
  await ensureLocalStore();
  await run(STORE_IMPORTS, "readwrite", (s) => s.put(list));
}

export function newLocalId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
