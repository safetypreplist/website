import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";

const GENERIC =
  "If that matches a purchase, your devices have been reset. Check your email if you need your license key.";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = normalizeLicenseKeyLoose(String(body.key || ""));
    const email = String(body.email || "").trim().toLowerCase();

    // Rate-limit by key (and IP) so guessing is slow. Always return the same message.
    const limited =
      (await rateLimitBlock(`reset-key:${key || "none"}`, 5, 3600)) ||
      (await rateLimitBlock(`reset-ip:${clientIp(req)}`, 20, 3600));
    if (limited) return limited;

    if (!key || !email) return json({ message: GENERIC });

    const admin = serviceClient();
    const license = await findLicenseByKey(admin, key);
    const match =
      license &&
      license.status === "active" &&
      license.email &&
      license.email.trim().toLowerCase() === email;

    if (match) {
      await admin.from("license_devices").delete().eq("license_id", license.id);
    }

    return json({ message: GENERIC });
  } catch (err) {
    console.error(err);
    // Do not reveal failure details.
    return json({ message: GENERIC });
  }
});
