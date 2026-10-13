export type EmailMessage = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type EmailResult = { ok: boolean; provider: "resend" | "brevo" | null; error?: string };

function sender() {
  const raw = Deno.env.get("EMAIL_FROM")?.trim() || "Safety Prep List <info@safetypreplist.com>";
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || "Safety Prep List", email: match[2].trim() } : { name: "Safety Prep List", email: raw };
}

export function emailConfigured() {
  return Boolean(Deno.env.get("RESEND_API_KEY")?.trim() || Deno.env.get("BREVO_API_KEY")?.trim());
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const from = sender();
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${from.name} <${from.email}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });
    if (res.ok) return { ok: true, provider: "resend" };
    const error = await res.text();
    console.error("Resend send failed", res.status, error);
    return { ok: false, provider: "resend", error };
  }

  const brevoKey = Deno.env.get("BREVO_API_KEY")?.trim();
  if (brevoKey) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: from,
        to: [{ email: message.to, ...(message.toName ? { name: message.toName } : {}) }],
        subject: message.subject,
        htmlContent: message.html,
        ...(message.text ? { textContent: message.text } : {}),
        ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
      }),
    });
    if (res.ok) return { ok: true, provider: "brevo" };
    const error = await res.text();
    console.error("Brevo send failed", res.status, error);
    return { ok: false, provider: "brevo", error };
  }

  return { ok: false, provider: null, error: "No email provider is configured." };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => (
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;"
  ));
}
