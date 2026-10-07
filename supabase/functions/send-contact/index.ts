import { isValidEmail, normalizeEmail } from "../_shared/brevo.ts";
import { json, preflight } from "../_shared/http.ts";

const TOPICS: Record<string, string> = {
  general: "Contact",
  refund: "Refund request",
  cancel: "Cancel subscription",
  privacy: "Privacy request",
  "do-not-sell": "Do not sell or share",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return "&quot;";
  });
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

  const key = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!key) return json({ error: "The contact form is not connected yet." }, 503);

  const to = Deno.env.get("SUPPORT_EMAIL")?.trim() || "info@safetypreplist.com";
  const from = Deno.env.get("EMAIL_FROM")?.trim() || "Safety Prep List <info@safetypreplist.com>";
  const label = TOPICS[topic];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `${label} — ${name}`,
      html: `
        <div style="font-family:Georgia,serif;color:#1E2A1F;line-height:1.5;">
          <p><strong>${escapeHtml(label)}</strong></p>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Reply to:</strong> ${escapeHtml(email)}</p>
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    console.error(await res.text());
    return json({ error: "Could not send that message. Please try again." }, 502);
  }

  return json({ ok: true });
});
