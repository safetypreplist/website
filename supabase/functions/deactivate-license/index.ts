import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose, type LicenseRow } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_DAYS = 30;

type LicenseWithDeactivate = LicenseRow & { last_deactivated_at?: string | null };

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
    const license = (await findLicenseByKey(admin, key)) as LicenseWithDeactivate | null;
    if (!license || license.status !== "active") {
      return json({ error: "That license key is not valid." }, 403);
    }

    const active = await admin
      .from("license_devices")
      .select("device_id")
      .eq("license_id", license.id)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!active.data) {
      return json({ error: "This device is not the active device for that license." }, 403);
    }

    const last = license.last_deactivated_at ? Date.parse(license.last_deactivated_at) : NaN;
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_DAYS * DAY_MS) {
      return json(
        {
          error:
            "This license was already deactivated recently. Wait 30 days, or use Reset devices with your email and key.",
        },
        429,
      );
    }

    const deleted = await admin
      .from("license_devices")
      .delete()
      .eq("license_id", license.id)
      .eq("device_id", deviceId);
    if (deleted.error) {
      console.error(deleted.error);
      return json({ error: "Could not deactivate device." }, 500);
    }

    await admin
      .from("licenses")
      .update({ last_deactivated_at: new Date().toISOString() })
      .eq("id", license.id);

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not deactivate device." }, 500);
  }
});
