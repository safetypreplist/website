import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";

const REFRESH_MS = 60_000;

/** Number of refund requests waiting for the owner. Refreshes every minute and when the tab regains focus. */
export function usePendingRefunds(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;
    let live = true;
    async function load() {
      const { count: pending, error } = await supabase
        .from("refund_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (live && !error) setCount(pending ?? 0);
    }
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [enabled]);

  return [count, setCount] as const;
}
