import { escapeHtml, sendEmail, emailConfigured } from "./email.ts";
import { serviceClient } from "./supabase.ts";

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type LicenseProduct = "basic" | "pro";

export type LicenseRow = {
  id: string;
  license_key: string;
  product: LicenseProduct;
  devices_allowed: number;
  status: "active" | "revoked";
  email: string | null;
  stripe_session_id: string | null;
  amount_cents: number | null;
  linked_to?: string | null;
  last_deactivated_at?: string | null;
  created_at: string;
};

/** SPL-XXXX-XXXX-XXXX-XXXX from crypto.getRandomValues (never from Stripe IDs). */
export function generateLicenseKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += KEY_ALPHABET[b % KEY_ALPHABET.length];
  return `SPL-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/** Accept pasted keys with or without dashes. */
export function normalizeLicenseKeyLoose(raw: string) {
  const compact = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const body = compact.startsWith("SPL") ? compact.slice(3) : compact;
  if (body.length !== 16) return String(raw || "").trim().toUpperCase();
  return `SPL-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
}

export async function uniqueLicenseKey(admin: ReturnType<typeof serviceClient>) {
  for (let i = 0; i < 8; i++) {
    const key = generateLicenseKey();
    const clash = await admin.from("licenses").select("id").eq("license_key", key).maybeSingle();
    if (!clash.data) return key;
  }
  throw new Error("Could not allocate a license key.");
}

export async function findLicenseByKey(admin: ReturnType<typeof serviceClient>, rawKey: string) {
  const key = normalizeLicenseKeyLoose(rawKey);
  const { data, error } = await admin.from("licenses").select("*").eq("license_key", key).maybeSingle();
  if (error) throw error;
  return (data as LicenseRow | null) ?? null;
}

export async function sendLicenseEmail(opts: {
  to: string;
  licenseKey: string;
  product: LicenseProduct;
  upgraded?: boolean;
  additional?: boolean;
}) {
  if (!emailConfigured() || !opts.to) return { skipped: true as const };
  const appUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").replace(/\/+$/, "");
  const support = Deno.env.get("SUPPORT_EMAIL") || "info@safetypreplist.com";
  const plan = opts.product === "pro" ? "Pro" : "Basic";
  const title = opts.upgraded
    ? "Your upgrade to Pro is complete"
    : opts.additional
      ? "Your second license is ready"
      : "Your license key";
  const subject = opts.additional
    ? "Your second Safety Prep List license."
    : `Your Safety Prep List ${plan} license — ${opts.licenseKey}`;
  const key = escapeHtml(opts.licenseKey);
  const activateUrl = `${appUrl}/activate?key=${encodeURIComponent(opts.licenseKey)}`;
  const activate = escapeHtml(activateUrl);
  const logo = escapeHtml(`${appUrl}/brand/logo.png`);
  const supportSafe = escapeHtml(support);
  const oneDevice =
    "No account is required. One license covers one device. Need another device? After you activate, you can add a second device license from your license page inside the app, or use Reset devices if you've lost access to this one.";

  const intro = opts.additional
    ? "You purchased an additional Basic license for another device. Open Activate on that device — your key is included in the link."
    : opts.upgraded
      ? `Your license is now <strong>${escapeHtml(plan)}</strong>. Your key stays the same.`
      : `You purchased <strong>${escapeHtml(plan)}</strong> as a one-time license. Save this key — you will need it to activate on your device.`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F4F0E5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0E5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#FBF8F1;border:1px solid #E6E2D6;border-radius:14px;">
          <tr>
            <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1E2A1F;">
              <p style="margin:0 0 18px;"><img src="${logo}" width="64" alt="Safety Prep List" style="display:inline-block;width:64px;height:auto;border:0;"></p>
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#556B2F;font-weight:bold;">Safety Prep List</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${escapeHtml(title)}</h1>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">${intro}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0E5;border:1px solid #E6E2D6;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#556B2F;font-weight:bold;">License key</p>
                    <p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:20px;letter-spacing:.06em;color:#1E2A1F;font-weight:bold;">${key}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0;text-align:center;">
                <a href="${activate}" style="display:inline-block;background:#C75A2B;color:#FBF8F1;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">Activate your license</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#4D5348;">${escapeHtml(oneDevice)}</p>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#556B2F;">Questions? ${supportSafe}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${title}

Product: ${plan}
License key: ${opts.licenseKey}

Activate: ${activateUrl}

${oneDevice}

Support: ${support}
`;

  const sent = await sendEmail({
    to: opts.to,
    subject,
    html,
    text,
  });
  return { skipped: false as const, ok: sent.ok };
}
