import { emailConfigured, escapeHtml, sendEmail } from "../_shared/email.ts";
import { json, preflight } from "../_shared/http.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { createLiveAgentTicket, liveAgentConfigured } from "../_shared/liveagent.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const limited = await rateLimitBlock(`ticket:${clientIp(req)}`, 8, 600);
  if (limited) return limited;

  const { user, supabase } = await requireUser(req);
  if (!user) return json({ error: "Please sign in again." }, 401);

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = String(body.message || "").trim().slice(0, 4000);
  if (!message) return json({ error: "Write a short note so we know how to help." }, 400);

  const { data: profile } = await serviceClient()
    .from("profiles")
    .select("email, first_name, last_name, display_name, plan, access_status")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email || profile?.email || "";
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.display_name || "";

  const { error: saveError } = await supabase.from("help_requests").insert({
    user_id: user.id,
    email: email || null,
    name: name || null,
    message,
  });
  if (saveError) {
    console.error("help_requests insert failed", saveError);
    return json({ error: "Could not send that message. Please try again." }, 500);
  }

  const details = [
    `Name: ${name || "Not set"}`,
    `Email: ${email || "Not set"}`,
    `Plan: ${profile?.plan || "none"} (${profile?.access_status || "unknown"})`,
    `Account ID: ${user.id}`,
  ].join("\n");
  const subject = `Help request — ${name || email || "Safety Prep List customer"}`;

  if (liveAgentConfigured() && email) {
    const ticket = await createLiveAgentTicket({
      email,
      name,
      subject,
      department: "support",
      message: `${message}\n\n---\nSent from the in-app Help page\n${details}`,
    });
    if (ticket.ok) return json({ ok: true });
  }

  if (emailConfigured()) {
    await sendEmail({
      to: Deno.env.get("SUPPORT_EMAIL")?.trim() || "info@safetypreplist.com",
      replyTo: email || undefined,
      subject,
      html: `
        <div style="font-family:Georgia,serif;color:#1E2A1F;line-height:1.5;">
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
          <p style="color:#556B2F;">${escapeHtml(details).replace(/\n/g, "<br>")}</p>
        </div>
      `,
    });
  }

  return json({ ok: true });
});
