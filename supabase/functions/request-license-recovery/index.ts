import { json, preflight } from "../_shared/http.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import {
  RECOVERY_TOKEN_TTL_MS,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  randomToken,
  sendLicenseRecoveryEmail,
  sha256Hex,
} from "../_shared/transfer.ts";

const GENERIC = {
  ok: true,
  message:
    "If that email is associated with a purchase, we sent a secure recovery link. Check your inbox and spam folder.",
};

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`req-recover:${clientIp(req)}`, 8, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = normalizeEmail(String(body.email || ""));
    if (!isValidEmail(email)) {
      // Same shape as a successful request so invalid emails are not distinguishable.
      return json({ ...GENERIC, emailMasked: null });
    }

    const emailLimited = await rateLimitBlock(`req-recover-email:${email}`, 4, 3600);
    if (emailLimited) return emailLimited;

    const admin = serviceClient();
    const { data: licenses, error } = await admin.rpc("licenses_for_email", { p_email: email });
    if (error) {
      console.error(error);
      return json({ ...GENERIC, emailMasked: null });
    }

    const rows = Array.isArray(licenses) ? licenses : [];
    if (!rows.length) {
      return json({ ...GENERIC, emailMasked: null });
    }

    // Invalidate unused prior tokens for this email.
    await admin
      .from("license_recovery_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("email_normalized", email)
      .is("used_at", null);

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + RECOVERY_TOKEN_TTL_MS).toISOString();
    const inserted = await admin.from("license_recovery_tokens").insert({
      email_normalized: email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      request_ip: clientIp(req),
    });
    if (inserted.error) {
      console.error(inserted.error);
      return json({ ...GENERIC, emailMasked: maskEmail(email) });
    }

    const appUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").replace(/\/+$/, "");
    const recoverUrl = `${appUrl}/license-recovery?token=${encodeURIComponent(token)}`;
    await sendLicenseRecoveryEmail({ to: email, recoverUrl });

    return json({
      ...GENERIC,
      emailMasked: maskEmail(email),
    });
  } catch (err) {
    console.error(err);
    return json({ ...GENERIC, emailMasked: null });
  }
});
