import { escapeHtml, sendEmail, emailConfigured } from "./email.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose, type LicenseRow } from "./licenses.ts";
import { serviceClient } from "./supabase.ts";

export const TRANSFER_TTL_MS = 48 * 60 * 60 * 1000;
export const DEACTIVATE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RECOVERY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_BACKUP_BYTES = 1_500_000;
export const MAX_BACKUPS_PER_DAY = 3;

export function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase().slice(0, 254);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function maskEmail(email: string | null | undefined) {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at < 1 || at === raw.length - 1) return null;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const domainParts = domain.split(".");
  const name = domainParts[0] || "";
  const tld = domainParts.slice(1).join(".") || "com";
  const localMasked = `${local[0]}***`;
  const domainMasked = name ? `${name[0]}***` : "***";
  return `${localMasked}@${domainMasked}.${tld}`;
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requireLicenseByKey(rawKey: string) {
  const admin = serviceClient();
  const license = await findLicenseByKey(admin, rawKey);
  if (!license || license.status !== "active") return { admin, license: null as LicenseRow | null };
  return { admin, license };
}

export async function licenseDeviceActive(
  admin: ReturnType<typeof serviceClient>,
  licenseId: string,
  deviceId: string,
) {
  const { data } = await admin
    .from("license_devices")
    .select("device_id")
    .eq("license_id", licenseId)
    .eq("device_id", deviceId)
    .maybeSingle();
  return Boolean(data);
}

export async function purgeExpiredTransferBackups(admin: ReturnType<typeof serviceClient>, licenseId?: string) {
  const now = new Date().toISOString();
  let query = admin
    .from("license_transfer_backups")
    .select("id, storage_path")
    .is("deleted_at", null)
    .lt("expires_at", now);
  if (licenseId) query = query.eq("license_id", licenseId);
  const { data } = await query.limit(50);
  for (const row of data || []) {
    await admin.storage.from("license-transfers").remove([row.storage_path]);
    await admin
      .from("license_transfer_backups")
      .update({ deleted_at: now })
      .eq("id", row.id);
  }
}

export async function sendDeactivateConfirmEmail(opts: {
  to: string;
  confirmUrl: string;
  product: string;
}) {
  if (!emailConfigured() || !opts.to) return { skipped: true as const };
  const support = Deno.env.get("SUPPORT_EMAIL") || "info@safetypreplist.com";
  const appUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").replace(/\/+$/, "");
  const logo = escapeHtml(`${appUrl}/brand/logo.png`);
  const confirm = escapeHtml(opts.confirmUrl);
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
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Move your license to a new device</h1>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">
                Someone asked to move your ${escapeHtml(opts.product)} license to a new device because the old one can't be used.
                If that was you, open this link on the new device. It works once and expires in 24 hours.
              </p>
              <p style="margin:22px 0;text-align:center;">
                <a href="${confirm}" style="display:inline-block;background:#C75A2B;color:#FBF8F1;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">Move my license here</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#4D5348;">
                The old device stops opening your checklist the next time it goes online. A cloud backup made in the last
                48 hours is offered on the new device after it activates. If you did not ask for this, ignore this email.
              </p>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#556B2F;">Questions? ${escapeHtml(support)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `Move your license to a new device\n\nOpen this link once, on the new device, to move your license there:\n${opts.confirmUrl}\n\nThis link expires in 24 hours. If you did not ask for this, ignore this email.`;
  return await sendEmail({
    to: opts.to,
    subject: "Move your Safety Prep List license to a new device",
    html,
    text,
  });
}

export async function sendLicenseRecoveryEmail(opts: {
  to: string;
  recoverUrl: string;
}) {
  if (!emailConfigured() || !opts.to) return { skipped: true as const };
  const support = Deno.env.get("SUPPORT_EMAIL") || "info@safetypreplist.com";
  const appUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").replace(/\/+$/, "");
  const logo = escapeHtml(`${appUrl}/brand/logo.png`);
  const recover = escapeHtml(opts.recoverUrl);
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
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Recover your license key</h1>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">
                Someone requested license recovery for this email. If that was you, open the secure link below to view your license key.
                This link works once and expires in 24 hours.
              </p>
              <p style="margin:22px 0;text-align:center;">
                <a href="${recover}" style="display:inline-block;background:#C75A2B;color:#FBF8F1;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">View my license key</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#4D5348;">
                If your license is still in use on another device, enter your key on the device you want to use and Activate shows you how to move it there.
              </p>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#556B2F;">Questions? ${escapeHtml(support)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `Recover your Safety Prep List license key\n\nOpen this secure link once to view your key:\n${opts.recoverUrl}\n\nThis link expires in 24 hours. If you did not request this, ignore this email.`;
  return await sendEmail({
    to: opts.to,
    subject: "Recover your Safety Prep List license key",
    html,
    text,
  });
}

export { normalizeLicenseKeyLoose };
