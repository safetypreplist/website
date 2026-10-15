import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";

export const COMING_SOON_KEY = "coming_soon";
export const COMING_SOON_EVENT = "spl:coming-soon-changed";
export const COMING_SOON_MAX_MESSAGE = 600;
export const DEFAULT_COMING_SOON_MESSAGE =
  "Safety Prep List is almost here! We’re putting the finishing touches on your preparedness experience. Please check back soon!";

const CACHE_KEY = "spl.comingSoon.v1";
const FETCH_TIMEOUT_MS = 4000;

export type ComingSoonSetting = { enabled: boolean; message: string };

export function parseComingSoon(value: unknown): ComingSoonSetting {
  const raw = (value && typeof value === "object" ? value : {}) as { enabled?: unknown; message?: unknown };
  const message = typeof raw.message === "string" ? raw.message.trim().slice(0, COMING_SOON_MAX_MESSAGE) : "";
  return { enabled: raw.enabled === true, message: message || DEFAULT_COMING_SOON_MESSAGE };
}

function readCache(): ComingSoonSetting | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? parseComingSoon(JSON.parse(cached)) : null;
  } catch {
    return null;
  }
}

function writeCache(setting: ComingSoonSetting) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(setting));
  } catch {
    // Private browsing can refuse storage; the live value is still used.
  }
}

/** Reads the setting. A missing row means "off". If the request fails, the last value this browser saw is used. */
export async function fetchComingSoon(): Promise<ComingSoonSetting> {
  if (!isSupabaseConfigured()) return parseComingSoon(null);
  try {
    const request = supabase.from("app_config").select("value").eq("key", COMING_SOON_KEY).maybeSingle();
    const result = await Promise.race([
      request,
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS)),
    ]);
    if (result.error) throw result.error;
    const setting = parseComingSoon(result.data?.value);
    writeCache(setting);
    return setting;
  } catch {
    return readCache() ?? parseComingSoon(null);
  }
}

export function announceComingSoonChange() {
  window.dispatchEvent(new Event(COMING_SOON_EVENT));
}

export function useComingSoon() {
  const [state, setState] = useState<{ ready: boolean; setting: ComingSoonSetting }>({
    ready: false,
    setting: parseComingSoon(null),
  });

  const refresh = useCallback(async () => {
    const setting = await fetchComingSoon();
    setState({ ready: true, setting });
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(COMING_SOON_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(COMING_SOON_EVENT, refresh);
    };
  }, [refresh]);

  return { ready: state.ready, enabled: state.setting.enabled, message: state.setting.message };
}

/** Pages anyone may reach while Coming Soon Mode is on, so owners and existing members can still sign in. */
const OPEN_PATHS = ["/signin", "/reset-password", "/update-password", "/privacy", "/terms", "/app", "/admin"];

export function isOpenDuringComingSoon(pathname: string) {
  return OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
