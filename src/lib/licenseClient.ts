import { invokeFunction } from "./supabase";

const DEVICE_KEY = "spl.license.deviceId.v1";
const LICENSE_KEY = "spl.license.session.v1";

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

/** Clear the local license session without calling the server (e.g. after Reset devices). */
export function clearLocalLicense() {
  writeStored(null);
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

export async function deactivate() {
  const license = readStored();
  if (!license) return;
  try {
    await invokeFunction("deactivate-license", {
      key: license.key,
      deviceId: getDeviceId(),
    });
  } finally {
    writeStored(null);
  }
}

/** Update local product after a successful Basic → Pro upgrade. */
export function setLocalProduct(product: LicenseProduct) {
  const current = readStored();
  if (!current) return;
  writeStored({ ...current, product });
}
