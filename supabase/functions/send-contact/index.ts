import { isValidEmail, normalizeEmail } from "../_shared/brevo.ts";
import { emailConfigured, escapeHtml, sendEmail } from "../_shared/email.ts";
import { json, preflight } from "../_shared/http.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { createLiveAgentTicket, liveAgentConfigured } from "../_shared/liveagent.ts";
import { serviceClient } from "../_shared/supabase.ts";

const TOPICS: Record<string, string> = {
  general: "Contact",
  refund: "Refund request",
  cancel: "Cancel subscription",
  privacy: "Privacy request",
  "do-not-sell": "Do not sell or share",
};

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const limited = await rateLimitBlock(`contact:${clientIp(req)}`, 5, 600);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    topic?: string;
    message?: string;
    company?: string;
  };

  if (String(body.company || "").trim()) return json({ ok: true });

  const name = String(body.name || "").trim().slice(0, 120);
  const email = normalizeEmail(body.email);
  const topic = TOPICS[String(body.topic || "")] ? String(body.topic) : "general";
  const message = String(body.message || "").trim().slice(0, 4000);

  if (!name) return json({ error: "Please enter your name." }, 400);
  if (!isValidEmail(email)) return json({ error: "Please enter a valid email so we can reply." }, 400);
  if (message.length < 8) return json({ error: "Please tell us a little more." }, 400);

  const label = TOPICS[topic];

  if (topic === "refund") {
    try {
      const admin = serviceClient();
      const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      const { error } = await admin.from("refund_requests").insert({
        user_id: (profile as { id: string } | null)?.id ?? null,
        email,
        name,
        message,
      });
      if (error) console.error("Could not save refund request", error);
    } catch (err) {
      console.error("Could not save refund request", err);
    }
  }

  if (liveAgentConfigured()) {
    const ticket = await createLiveAgentTicket({
      email,
      name,
      subject: `${label} — ${name}`,
      department: topic === "general" ? "sales" : "support",
      message: `${message}\n\n---\nSent from the website contact form\nName: ${name}\nEmail: ${email}\nTopic: ${label}`,
    });
    if (ticket.ok) return json({ ok: true });
  }

  if (!emailConfigured()) return json({ error: "The contact form is not connected yet." }, 503);

  const to = Deno.env.get("SUPPORT_EMAIL")?.trim() || "info@safetypreplist.com";

  const sent = await sendEmail({
    to,
    replyTo: email,
    subject: `${label} — ${name}`,
    html: `
        <div style="font-family:Georgia,serif;color:#1E2A1F;line-height:1.5;">
          <p><strong>${escapeHtml(label)}</strong></p>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Reply to:</strong> ${escapeHtml(email)}</p>
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        </div>
      `,
  });

  if (!sent.ok) {
    return json({ error: "Could not send that message. Please try again." }, 502);
  }

  return json({ ok: true });
});
