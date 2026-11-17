import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`deactivate:${clientIp(req)}`, 30, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = normalizeLicenseKeyLoose(String(body.key || ""));
    const deviceId = String(body.deviceId || "").trim();
    if (!key || !deviceId) return json({ error: "License key and device id are required." }, 400);

    const admin = serviceClient();
    const license = await findLicenseByKey(admin, key);
    if (!license || license.status !== "active") {
      return json({ error: "That license key is not valid." }, 403);
    }

    await admin.from("license_devices").delete().eq("license_id", license.id).eq("device_id", deviceId);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not deactivate device." }, 500);
  }
});
