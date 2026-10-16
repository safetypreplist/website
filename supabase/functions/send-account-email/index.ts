import { isValidEmail, normalizeEmail } from "../_shared/brevo.ts";
import { emailConfigured, escapeHtml, sendEmail } from "../_shared/email.ts";
import { json, preflight } from "../_shared/http.ts";
import { rateLimitBlock } from "../_shared/rateLimit.ts";
import { requireUser } from "../_shared/supabase.ts";

function configuredBase() {
  return (Deno.env.get("APP_URL")?.trim() || "https://safetypreplist.com").replace(/\/+$/, "");
}

function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || "";
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { user } = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const limited = await rateLimitBlock(`welcome:${user.id}`, 1, 86400);
  if (limited) return json({ ok: true, alreadySent: true });

  const body = await req.json().catch(() => ({})) as { name?: string };
  const email = normalizeEmail(user.email);
  if (!isValidEmail(email)) return json({ error: "Could not send that email." }, 400);

  const name = String(body.name || user.user_metadata?.full_name || user.user_metadata?.first_name || "").trim();
  const first = escapeHtml(firstNameOf(name) || "there");
  const signIn = escapeHtml(`${configuredBase()}/signin`);
  const logo = escapeHtml(`${configuredBase()}/brand/logo.png`);

  if (!emailConfigured()) {
    console.error("Account email skipped: no email provider");
    return json({ ok: true, skipped: true });
  }

  const html = `
  <div style="background:#F4F0E5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1E2A1F;">
    <div style="max-width:560px;margin:0 auto;background:#FBF8F1;border:1px solid #E6E2D6;border-radius:14px;padding:32px;">
      <p style="margin:0 0 18px;text-align:center;">
        <img src="${logo}" width="64" height="79" alt="Safety Prep List" style="display:inline-block;width:64px;height:auto;border:0;">
      </p>
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#556B2F;font-weight:bold;">Safety Prep List</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">Your account is all set!</h1>
      <p style="font-size:16px;line-height:1.5;">Hi ${first},</p>
      <p style="font-size:16px;line-height:1.5;">Your Safety Prep List account is all set!</p>
      <p style="font-size:16px;line-height:1.5;">You can now sign in anytime to check off items, add notes, and keep your household preparedness lists organized in one place.</p>
      <p style="font-size:16px;line-height:1.5;">A little preparation today can make a big difference tomorrow.</p>
      <p style="font-size:16px;line-height:1.5;font-style:italic;">Hope for the best. Prepare for the rest.</p>
      <p style="font-size:16px;line-height:1.5;">The Safety Prep List Team</p>
      <p style="margin:28px 0;text-align:center;">
        <a href="${signIn}" style="display:inline-block;background:#C75A2B;color:#FBF8F1;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">Sign in Now</a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#4D5348;">If the button doesn’t work, copy this address into your browser:<br><span style="word-break:break-all;color:#556B2F;">${signIn}</span></p>
    </div>
  </div>`;
  const text = `Hi ${firstNameOf(name) || "there"},\n\nYour Safety Prep List account is all set!\n\nYou can now sign in anytime to check off items, add notes, and keep your household preparedness lists organized in one place.\n\nA little preparation today can make a big difference tomorrow.\n\nHope for the best. Prepare for the rest.\n\nThe Safety Prep List Team\n\nSign in Now: ${configuredBase()}/signin\n`;

  const sent = await sendEmail({
    to: email,
    toName: name || undefined,
    subject: "Your Safety Prep List account is ready",
    html,
    text,
  });
  if (!sent.ok) {
    console.error("Account email failed", sent.error);
    return json({ error: "Could not send that email." }, 502);
  }
  return json({ ok: true });
});
