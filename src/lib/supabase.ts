import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    "Supabase is not configured. Copy .env.example to .env.local and add your project URL and anon key.",
  );
}

export const supabase = createClient(url || "https://example.supabase.co", anon || "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function isSupabaseConfigured() {
  return Boolean(url && anon && !url.includes("YOUR_PROJECT"));
}

async function functionErrorMessage(error: { message?: string; context?: unknown }) {
  const fallback = error.message || "Something went wrong. Please try again.";
  const context = error.context as { json?: () => Promise<unknown>; clone?: () => { json?: () => Promise<unknown> } } | undefined;
  const read = context?.json || context?.clone?.().json;
  if (!read) return fallback;
  try {
    const payload = await read();
    if (payload && typeof payload === "object" && "error" in payload && payload.error) {
      return String((payload as { error: string }).error);
    }
  } catch {
    /* keep the client message */
  }
  if (fallback.includes("non-2xx")) return "Something went wrong. Please try again.";
  return fallback;
}

export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(await functionErrorMessage(error));
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}
