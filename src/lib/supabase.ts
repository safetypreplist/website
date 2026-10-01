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

export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}
