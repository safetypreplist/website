import { useSyncExternalStore } from "react";

export const INSTALL_URL = "https://safetypreplist.com/install";
export const INSTALL_URL_LABEL = "safetypreplist.com/install";

export type InstallPlatform =
  | "ios-safari"
  | "ios-other"
  | "android"
  | "desktop-chromium"
  | "mac-safari"
  | "desktop-firefox"
  | "other";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Chrome, Edge, and Samsung Internet fire this once per page load, so it has to be caught at startup. */
export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribe, () => Boolean(deferred), () => false);
  const justInstalled = useSyncExternalStore(subscribe, () => installedNow, () => false);
  return { canPrompt, justInstalled };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

export function isInstalledApp() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return Boolean(standalone || (navigator as Navigator & { standalone?: boolean }).standalone);
}

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOS) {
    return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua) ? "ios-other" : "ios-safari";
  }
  if (/Android/i.test(ua)) return "android";
  if (/Firefox\//i.test(ua)) return "desktop-firefox";
  if (/Edg\/|Chrome\/|Chromium\//i.test(ua)) return "desktop-chromium";
  if (/Macintosh/i.test(ua) && /Safari\//i.test(ua)) return "mac-safari";
  return "other";
}

export function isPhoneOrTablet(platform: InstallPlatform) {
  return platform === "ios-safari" || platform === "ios-other" || platform === "android";
}
