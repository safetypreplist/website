import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { emailConfigured, escapeHtml, sendEmail } from "./email.ts";

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service credentials missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function userClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("Supabase anon credentials missing");
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

export async function requireUser(req: Request) {
  const supabase = userClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { user: null, supabase };
  return { user: data.user, supabase };
}

export async function productBySlug(slug: string) {
  const admin = serviceClient();
  const { data, error } = await admin
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data as {
    slug: string;
    name: string;
    amount_cents: number;
    currency: string;
    kind: string;
    grants_plan: string | null;
    device_slots: number;
  } | null;
}

export async function sendPurchaseEmail(opts: {
  to: string;
  planName: string;
  productCode: string;
  deviceAllowance: string;
}) {
  const appUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").replace(/\/+$/, "");
  const support = Deno.env.get("SUPPORT_EMAIL") || "info@safetypreplist.com";
  if (!emailConfigured() || !opts.to) return { skipped: true };

  const plan = escapeHtml(opts.planName);
  const code = escapeHtml(opts.productCode);
  const billing = escapeHtml(opts.deviceAllowance);
  const signIn = escapeHtml(`${appUrl}/signin`);
  const logo = escapeHtml(`${appUrl}/brand/logo.png`);
  const supportSafe = escapeHtml(support);

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F4F0E5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0E5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#FBF8F1;border:1px solid #E6E2D6;border-radius:14px;">
          <tr>
            <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1E2A1F;">
              <p style="margin:0 0 18px;text-align:left;">
                <img src="${logo}" width="64" alt="Safety Prep List" style="display:inline-block;width:64px;height:auto;border:0;">
              </p>
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#556B2F;font-weight:bold;">Safety Prep List</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Thank you for your purchase</h1>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">Your plan is confirmed. Save this confirmation number in case you need help with your account.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0E5;border:1px solid #E6E2D6;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#556B2F;font-weight:bold;">Confirmation number</p>
                    <p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:22px;letter-spacing:.06em;color:#1E2A1F;font-weight:bold;">${code}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 8px;font-size:16px;line-height:1.55;"><strong>Plan:</strong> ${plan}</p>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.55;"><strong>Billing:</strong> ${billing}</p>
              <p style="margin:0 0 22px;text-align:center;">
                <a href="${signIn}" style="display:inline-block;background:#C75A2B;color:#FBF8F1;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">Open Safety Prep List</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#4D5348;">Create your account with the same email if you have not already. This confirmation number is already linked to your purchase.</p>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#556B2F;">Questions? ${supportSafe}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Thank you for your Safety Prep List purchase.

Confirmation number: ${opts.productCode}
Plan: ${opts.planName}
Billing: ${opts.deviceAllowance}

Open Safety Prep List: ${appUrl}/signin

Create your account with the same email if you have not already. This confirmation number is already linked to your purchase.

Support: ${support}
`;

  const sent = await sendEmail({
    to: opts.to,
    subject: `Your Safety Prep List confirmation — ${opts.productCode}`,
    html,
    text,
  });
  return { skipped: false, ok: sent.ok };
}
