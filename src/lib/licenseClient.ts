import { invokeFunction } from "./supabase";

const DEVICE_KEY = "spl.license.deviceId.v1";
const LICENSE_KEY = "spl.license.session.v1";
export const ACTIVATE_MESSAGE_KEY = "spl.activate.message";
const MOVED_KEY = "spl.activate.movedKey";

export type LicenseProduct = "basic" | "pro";

export type StoredLicense = {
  key: string;
  product: LicenseProduct;
  activatedAt: string;
};

type ActivateResponse = {
  product: LicenseProduct;
  status: "active";
  licenseKey?: string;
  error?: string;
};

export type LicenseStatusResponse = {
  product: LicenseProduct;
  amountCents?: number | null;
  purchasedAt?: string;
  licenseKey: string;
  devices: Array<{ deviceId: string; activatedAt: string }>;
  /** Sent by servers that know which device is asking; older servers leave it out. */
  thisDevice?: boolean;
};

/** Whether the license is active on this device, from a license-status answer. */
export function activeOnThisDevice(data: Pick<LicenseStatusResponse, "devices" | "thisDevice">) {
  if (typeof data.thisDevice === "boolean") return data.thisDevice;
  const deviceId = getDeviceId();
  return data.devices.some((row) => row.deviceId === deviceId);
}

const STATUS_MAX_AGE_MS = 60_000;
const statusCache = new Map<string, { at: number; data: LicenseStatusResponse }>();
const statusInFlight = new Map<string, Promise<LicenseStatusResponse>>();

/**
 * license-status is rate limited per IP, and every app route checks it.
 * Share one recent answer (and any in-flight request) so normal navigation never trips the limit.
 */
export function fetchLicenseStatus(key: string, options?: { fresh?: boolean }): Promise<LicenseStatusResponse> {
  const cacheKey = key.trim().toUpperCase();
  const cached = statusCache.get(cacheKey);
  if (!options?.fresh && cached && Date.now() - cached.at < STATUS_MAX_AGE_MS) return Promise.resolve(cached.data);
  const pending = statusInFlight.get(cacheKey);
  if (pending) return pending;
  const request = invokeFunction<LicenseStatusResponse>("license-status", { key: key.trim(), deviceId: getDeviceId() })
    .then((data) => {
      statusCache.set(cacheKey, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      statusInFlight.delete(cacheKey);
    });
  statusInFlight.set(cacheKey, request);
  return request;
}

export function forgetLicenseStatus() {
  statusCache.clear();
}

export function isRateLimitError(err: unknown) {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return message.includes("wait a moment") || message.includes("429") || message.includes("too many");
}

function syncStoredProduct(product: LicenseProduct) {
  const current = readStored();
  if (!current || current.product === product) return;
  writeStored({ ...current, product });
}

function readStored(): StoredLicense | null {
  try {
    const raw = localStorage.getItem(LICENSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLicense;
    if (!parsed?.key || (parsed.product !== "basic" && parsed.product !== "pro")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(license: StoredLicense | null) {
  statusCache.clear();
  if (!license) {
    localStorage.removeItem(LICENSE_KEY);
    return;
  }
  localStorage.setItem(LICENSE_KEY, JSON.stringify(license));
}

/** Stable device id for license activation (not the old account device token). */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getLicense(): StoredLicense | null {
  return readStored();
}

export function isLicensed() {
  return Boolean(readStored()?.key);
}

/** Clear the local license session without calling the server (e.g. after deactivation). */
export function clearLocalLicense() {
  writeStored(null);
}

export function setActivateMessage(message: string) {
  sessionStorage.setItem(ACTIVATE_MESSAGE_KEY, message);
}

export function takeActivateMessage() {
  const message = sessionStorage.getItem(ACTIVATE_MESSAGE_KEY);
  if (message) sessionStorage.removeItem(ACTIVATE_MESSAGE_KEY);
  return message;
}

/** Keeps the key of a license that moved away so this device can still ask to move it back. */
function rememberMovedKey(key: string) {
  try {
    sessionStorage.setItem(MOVED_KEY, key);
  } catch {
    /* private mode */
  }
}

export function movedLicenseKey() {
  try {
    return sessionStorage.getItem(MOVED_KEY) || "";
  } catch {
    return "";
  }
}

export function isProLicense() {
  return readStored()?.product === "pro";
}

export async function activate(key: string): Promise<StoredLicense> {
  const deviceId = getDeviceId();
  const data = await invokeFunction<ActivateResponse>("activate-license", {
    key: key.trim(),
    deviceId,
  });
  if (!data || data.status !== "active" || (data.product !== "basic" && data.product !== "pro")) {
    throw new Error("Could not activate that license key.");
  }
  const stored: StoredLicense = {
    key: (data.licenseKey || key).trim().toUpperCase(),
    product: data.product,
    activatedAt: new Date().toISOString(),
  };
  writeStored(stored);
  return stored;
}

export async function deactivate(options?: { key?: string; deviceId?: string }) {
  const license = readStored();
  const key = (options?.key || license?.key || "").trim();
  const deviceId = (options?.deviceId || getDeviceId()).trim();
  if (!key || !deviceId) throw new Error("License key and device are required to deactivate.");
  await invokeFunction("deactivate-license", { key, deviceId });
  if (license && license.key.toUpperCase() === key.toUpperCase()) {
    writeStored(null);
  }
}

/**
 * When online, confirm this device is still the active one for the stored key.
 * Returns "moved" if another device holds the license, "invalid" if the key is revoked/invalid.
 */
export async function confirmLocalLicenseActive(): Promise<"ok" | "moved" | "invalid" | "skip"> {
  const license = readStored();
  if (!license) return "skip";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "ok";
  try {
    const data = await fetchLicenseStatus(license.key);
    if (data.product === "basic" || data.product === "pro") {
      syncStoredProduct(data.product);
    }
    if (!activeOnThisDevice(data)) {
      rememberMovedKey(license.key);
      writeStored(null);
      return "moved";
    }
    return "ok";
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("not valid") || message.includes("revoked")) {
      writeStored(null);
      return "invalid";
    }
    // Network / server errors: keep local access for offline-capable use.
    return "ok";
  }
}

/** Pull the latest Basic/Pro product from the server into local session storage. */
export async function refreshLocalLicenseProduct(): Promise<LicenseProduct | null> {
  const license = readStored();
  if (!license) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) return license.product;
  try {
    const data = await fetchLicenseStatus(license.key);
    if (data.product === "basic" || data.product === "pro") {
      syncStoredProduct(data.product);
      return data.product;
    }
  } catch {
    // Keep local product when offline or the status call fails.
  }
  return readStored()?.product ?? null;
}

/** Update local product after a successful Basic → Pro upgrade. */
export function setLocalProduct(product: LicenseProduct) {
  const current = readStored();
  if (!current) return;
  writeStored({ ...current, product });
}
