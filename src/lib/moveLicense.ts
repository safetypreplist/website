import { deactivate, getDeviceId } from "./licenseClient";
import { invokeFunction } from "./supabase";
import {
  buildTransferBackup,
  hasLocalPersonalData,
  parseTransferBackup,
  summarizeTransferBackup,
  transferBackupByteSize,
  transferBackupToJson,
  type TransferBackupPayload,
  type TransferBackupSummary,
} from "./transferBackup";

export type CloudBackup = { id: string; createdAt: string; expiresAt: string; byteSize: number };

export type FoundBackup = {
  backup: CloudBackup;
  payload: TransferBackupPayload;
  summary: TransferBackupSummary;
};

/** What the old device did before letting go of the license. */
export type MoveBackup =
  | { kind: "cloud"; expiresAt: string; summary: TransferBackupSummary }
  | { kind: "empty" }
  | { kind: "file" }
  | { kind: "none" };

export type MoveOutcome = { key: string; backup: MoveBackup };

const CREATED_HERE_KEY = "spl.move.backupsCreatedHere.v1";
const EMAIL_MOVE_KEY = "spl.move.emailRequest.v1";
const EMAIL_MOVE_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeKey(raw: string) {
  return raw.trim().toUpperCase();
}

/** Same tolerance as the server: dashes and spaces are optional. */
export function looksLikeLicenseKey(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.startsWith("SPL") && compact.length === 19;
}

export function moveLinkForKey(licenseKey: string) {
  const origin = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
  // The key rides in the fragment: browsers never send it to a server or in a Referer header.
  return `${origin}/activate#key=${encodeURIComponent(licenseKey)}`;
}

/** Reads a key from `/activate#key=…` or the older `/activate?key=…`. */
export function keyFromLocation(search: string, hash: string) {
  const fromHash = new URLSearchParams(hash.replace(/^#/, "")).get("key") || "";
  const fromQuery = new URLSearchParams(search).get("key") || "";
  return (fromHash || fromQuery).trim();
}

function readCreatedHere(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CREATED_HERE_KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberCreatedHere(id: string) {
  const next = [id, ...readCreatedHere().filter((item) => item !== id)].slice(0, 10);
  localStorage.setItem(CREATED_HERE_KEY, JSON.stringify(next));
}

export async function listCloudBackups(key: string): Promise<CloudBackup[]> {
  const data = await invokeFunction<{ backups?: CloudBackup[] }>("transfer-backup", { action: "status", key });
  return data.backups || [];
}

/** Newest cloud backup that was made on a different device (backups made here are already here). */
export function pickBackupFromElsewhere(backups: CloudBackup[], createdHere = readCreatedHere()) {
  const skip = new Set(createdHere);
  return [...backups]
    .filter((row) => !skip.has(row.id) && Date.parse(row.expiresAt) > Date.now())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

/** After activating: fetch the backup the old device left, if any. Never throws — no backup just means skip. */
export async function findBackupToRestore(key: string): Promise<FoundBackup | null> {
  try {
    const backup = pickBackupFromElsewhere(await listCloudBackups(key));
    if (!backup) return null;
    const data = await invokeFunction<{ payload?: unknown }>("transfer-backup", {
      action: "download",
      key,
      deviceId: getDeviceId(),
      backupId: backup.id,
    });
    const payload = parseTransferBackup(data.payload);
    return { backup, payload, summary: summarizeTransferBackup(payload) };
  } catch {
    return null;
  }
}

export async function createCloudBackup(key: string): Promise<{ backup: CloudBackup; summary: TransferBackupSummary }> {
  const payload = await buildTransferBackup();
  if (transferBackupByteSize(payload) > 1_500_000) {
    throw new Error("Your checklist is too large for the cloud backup. Save a backup file instead.");
  }
  const data = await invokeFunction<{ backup?: CloudBackup }>("transfer-backup", {
    action: "create",
    key,
    deviceId: getDeviceId(),
    payload: JSON.parse(transferBackupToJson(payload)),
  });
  if (!data.backup) throw new Error("The cloud backup did not finish. Try again.");
  rememberCreatedHere(data.backup.id);
  return { backup: data.backup, summary: summarizeTransferBackup(payload) };
}

/** Old device, step 1: back up (skipped when there is nothing to save). */
export async function backUpBeforeMove(key: string): Promise<MoveBackup> {
  if (!(await hasLocalPersonalData())) return { kind: "empty" };
  const { backup, summary } = await createCloudBackup(key);
  return { kind: "cloud", expiresAt: backup.expiresAt, summary };
}

/**
 * Old device, step 2: let go of the license. Only the device that holds the license can do this
 * (the server checks this device's id against the active one). Returns false when the license had
 * already moved somewhere else.
 */
export async function releaseThisDevice(key: string): Promise<boolean> {
  try {
    await deactivate({ key });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("not the active device")) return false;
    throw err;
  }
}

export function isDeviceTakenError(err: unknown) {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return message.includes("active on another device") || message.includes("in use on another device");
}

/** New device without the old one: email the purchase address a one-time link that frees the license. */
export async function requestMoveByEmail(key: string): Promise<{ emailMasked: string | null }> {
  const data = await invokeFunction<{ emailMasked?: string | null }>("request-deactivate-license", {
    key: key.trim(),
    backupDecision: "skipped",
    backupMethod: "none",
  });
  try {
    localStorage.setItem(EMAIL_MOVE_KEY, JSON.stringify({ key: normalizeKey(key), at: Date.now() }));
  } catch {
    /* private mode: the link still works, it just won't finish on its own */
  }
  return { emailMasked: data.emailMasked || null };
}

/** True when this device asked for the email link for this key (so opening it here can finish the move). */
export function takeEmailMoveRequest(key: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(EMAIL_MOVE_KEY) || "null") as { key?: string; at?: number } | null;
    localStorage.removeItem(EMAIL_MOVE_KEY);
    return Boolean(raw?.key && raw.key === normalizeKey(key) && Date.now() - Number(raw.at || 0) < EMAIL_MOVE_TTL_MS);
  } catch {
    return false;
  }
}

export function describeSummary(summary: TransferBackupSummary) {
  const parts = [
    summary.progressCount ? plural(summary.progressCount, "checklist item") : "",
    summary.customCount ? plural(summary.customCount, "custom item") : "",
    summary.contactCount ? plural(summary.contactCount, "contact") : "",
    summary.importedCount ? plural(summary.importedCount, "imported list") : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "your profile and settings";
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function formatExpiry(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string, now = Date.now()) {
  const made = Date.parse(iso);
  if (!Number.isFinite(made)) return "recently";
  const minutes = Math.max(0, Math.round((now - made) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}
