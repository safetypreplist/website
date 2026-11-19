import type { Contact, CustomChecklistItem, ProgressRow } from "../types";
import {
  ensureLocalStore,
  loadContacts,
  loadCustomItems,
  loadImportedLists,
  loadProgress,
  saveContact,
  saveCustomItem,
  saveImportedList,
  saveProgressMany,
  type ImportedChecklist,
} from "./localStore";
import { shareOrDownloadFile } from "./checklistShare";

const PREFERRED_STATE_KEY = "spl.preferredState.v1";
const PREP_LANE_KEY = "spl.prep-lane";
export const TRANSFER_BACKUP_KIND = "spl-transfer-backup";
export const TRANSFER_BACKUP_VERSION = 1;
export const MAX_TRANSFER_BACKUP_BYTES = 1_500_000;

export type TransferBackupPayload = {
  version: typeof TRANSFER_BACKUP_VERSION;
  kind: typeof TRANSFER_BACKUP_KIND;
  exportedAt: string;
  preferredState: string | null;
  prepLane: string | null;
  progress: ProgressRow[];
  customItems: CustomChecklistItem[];
  contacts: Contact[];
  importedLists: ImportedChecklist[];
};

export type TransferBackupSummary = {
  progressCount: number;
  customCount: number;
  contactCount: number;
  importedCount: number;
  exportedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function buildTransferBackup(): Promise<TransferBackupPayload> {
  await ensureLocalStore();
  const [progressMap, customItems, contacts, importedLists] = await Promise.all([
    loadProgress(),
    loadCustomItems(),
    loadContacts(),
    loadImportedLists(),
  ]);
  return {
    version: TRANSFER_BACKUP_VERSION,
    kind: TRANSFER_BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    preferredState: localStorage.getItem(PREFERRED_STATE_KEY),
    prepLane: localStorage.getItem(PREP_LANE_KEY),
    progress: Object.values(progressMap),
    customItems,
    contacts,
    importedLists,
  };
}

export function summarizeTransferBackup(payload: TransferBackupPayload): TransferBackupSummary {
  return {
    progressCount: payload.progress.length,
    customCount: payload.customItems.length,
    contactCount: payload.contacts.length,
    importedCount: payload.importedLists.length,
    exportedAt: payload.exportedAt,
  };
}

export function transferBackupToJson(payload: TransferBackupPayload) {
  return JSON.stringify(payload);
}

export function transferBackupByteSize(payload: TransferBackupPayload) {
  return new TextEncoder().encode(transferBackupToJson(payload)).length;
}

export function parseTransferBackup(raw: unknown): TransferBackupPayload {
  const data = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!isRecord(data)) throw new Error("That backup file is not valid.");
  if (data.kind !== TRANSFER_BACKUP_KIND) throw new Error("That file is not a Safety Prep List transfer backup.");
  if (data.version !== TRANSFER_BACKUP_VERSION) throw new Error("That backup version is not supported.");
  if (!Array.isArray(data.progress) || !Array.isArray(data.customItems) || !Array.isArray(data.contacts)) {
    throw new Error("That backup is missing checklist data.");
  }
  return {
    version: TRANSFER_BACKUP_VERSION,
    kind: TRANSFER_BACKUP_KIND,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    preferredState: typeof data.preferredState === "string" ? data.preferredState : null,
    prepLane: typeof data.prepLane === "string" ? data.prepLane : null,
    progress: data.progress as ProgressRow[],
    customItems: data.customItems as CustomChecklistItem[],
    contacts: data.contacts as Contact[],
    importedLists: Array.isArray(data.importedLists) ? (data.importedLists as ImportedChecklist[]) : [],
  };
}

export async function downloadTransferBackupFile(payload?: TransferBackupPayload) {
  const data = payload || (await buildTransferBackup());
  const blob = new Blob([transferBackupToJson(data)], { type: "application/json" });
  const stamp = data.exportedAt.slice(0, 10);
  const file = new File([blob], `safety-prep-list-backup-${stamp}.json`, { type: "application/json" });
  await shareOrDownloadFile(
    file,
    "Safety Prep List backup",
    "Save this file somewhere you can open from your new device, then use Transfer My Data → Import a Backup File.",
  );
  return summarizeTransferBackup(data);
}

export async function hasLocalPersonalData() {
  const payload = await buildTransferBackup();
  return (
    payload.progress.length > 0 ||
    payload.customItems.length > 0 ||
    payload.contacts.length > 0 ||
    payload.importedLists.length > 0
  );
}

/** Replace local personal data with a backup after the customer confirms overwrite. */
export async function restoreTransferBackup(payload: TransferBackupPayload) {
  await ensureLocalStore();
  const dbName = "spl-local";
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["progress", "customItems", "contacts", "importedLists"], "readwrite");
      tx.objectStore("progress").clear();
      tx.objectStore("customItems").clear();
      tx.objectStore("contacts").clear();
      tx.objectStore("importedLists").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  });

  if (payload.progress.length) await saveProgressMany(payload.progress);
  for (const item of payload.customItems) await saveCustomItem(item);
  for (const contact of payload.contacts) await saveContact(contact);
  for (const list of payload.importedLists) await saveImportedList(list);

  if (payload.preferredState) localStorage.setItem(PREFERRED_STATE_KEY, payload.preferredState);
  else localStorage.removeItem(PREFERRED_STATE_KEY);
  if (payload.prepLane) localStorage.setItem(PREP_LANE_KEY, payload.prepLane);
  else localStorage.removeItem(PREP_LANE_KEY);
}
