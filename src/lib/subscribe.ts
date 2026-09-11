import { invokeFunction, isSupabaseConfigured } from "./supabase";

export const CHECKLIST_PDF_PATH = "/downloads/SafetyPrepList_EmergencyDocumentsChecklist.pdf";

export async function subscribeChecklist(email: string, name = "", honeypot = "") {
  const payload = { email: email.trim(), name: name.trim(), company: honeypot };
  if (import.meta.env.DEV || !isSupabaseConfigured()) {
    const res = await fetch("/api/subscribe-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || "Could not join the list. Please try again.");
    return;
  }
  await invokeFunction("subscribe-checklist", payload);
}
