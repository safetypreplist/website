import { json, preflight } from "../_shared/http.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import {
  DEACTIVATE_TOKEN_TTL_MS,
  maskEmail,
  randomToken,
  requireLicenseByKey,
  sendDeactivateConfirmEmail,
  sha256Hex,
} from "../_shared/transfer.ts";

const GENERIC = {
  ok: true,
  message:
    "If that license key is valid, we sent a verification link to the email address associated with it.",
};

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`req-deact:${clientIp(req)}`, 12, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = String(body.key || "");
    const backupDecision =
      body.backupDecision === "backed_up" || body.backupDecision === "skipped" ? body.backupDecision : "unknown";
    const { admin, license } = await requireLicenseByKey(key);

    // Always return the same shape to avoid key/email enumeration.
    if (!license || !license.email) {
      console.log(
        JSON.stringify({
          event: "license_deactivate_requested",
          matched: false,
          backupDecision,
          at: new Date().toISOString(),
        }),
      );
      return json({ ...GENERIC, emailMasked: null });
    }

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + DEACTIVATE_TOKEN_TTL_MS).toISOString();
    const inserted = await admin.from("license_deactivation_tokens").insert({
      license_id: license.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      request_ip: clientIp(req),
    });
    if (inserted.error) {
      console.error(inserted.error);
      return json({ ...GENERIC, emailMasked: maskEmail(license.email) });
    }

    const appUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").replace(/\/+$/, "");
    const confirmUrl = `${appUrl}/transfer?confirm=${encodeURIComponent(token)}`;
    await sendDeactivateConfirmEmail({
      to: license.email,
      confirmUrl,
      product: license.product === "pro" ? "Pro" : "Basic",
    });

    console.log(
      JSON.stringify({
        event: "license_deactivate_requested",
        matched: true,
        licenseId: license.id,
        backupDecision,
        at: new Date().toISOString(),
      }),
    );

    return json({
      ...GENERIC,
      emailMasked: maskEmail(license.email),
    });
  } catch (err) {
    console.error(err);
    return json({ ...GENERIC, emailMasked: null });
  }
});
