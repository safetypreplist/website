import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";

const DEVICE_TAKEN =
  "This license is already active on another device. Use a second license for another device, or reset your devices if you've lost access.";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`activate:${clientIp(req)}`, 30, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = normalizeLicenseKeyLoose(String(body.key || ""));
    const deviceId = String(body.deviceId || "").trim();
    if (!key || !deviceId) return json({ error: "License key and device id are required." }, 400);
    if (deviceId.length > 128) return json({ error: "Invalid device id." }, 400);

    const admin = serviceClient();
    const license = await findLicenseByKey(admin, key);
    if (!license || license.status !== "active") {
      return json({ error: "That license key is not valid." }, 403);
    }

    const existing = await admin
      .from("license_devices")
      .select("device_id")
      .eq("license_id", license.id)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (existing.data) {
      return json({ product: license.product, status: "active", licenseKey: license.license_key });
    }

    const { count, error: countError } = await admin
      .from("license_devices")
      .select("device_id", { count: "exact", head: true })
      .eq("license_id", license.id);
    if (countError) {
      console.error(countError);
      return json({ error: "Could not activate license." }, 500);
    }
    if ((count ?? 0) >= 1) {
      return json({ error: DEVICE_TAKEN }, 409);
    }

    const inserted = await admin.from("license_devices").insert({
      license_id: license.id,
      device_id: deviceId,
    });
    if (inserted.error) {
      // Race: another request activated this device, or another device won the slot.
      const again = await admin
        .from("license_devices")
        .select("device_id")
        .eq("license_id", license.id)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (again.data) {
        return json({ product: license.product, status: "active", licenseKey: license.license_key });
      }
      const { count: afterRace } = await admin
        .from("license_devices")
        .select("device_id", { count: "exact", head: true })
        .eq("license_id", license.id);
      if ((afterRace ?? 0) >= 1) return json({ error: DEVICE_TAKEN }, 409);
      console.error(inserted.error);
      return json({ error: "Could not activate license." }, 500);
    }

    return json({ product: license.product, status: "active", licenseKey: license.license_key });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not activate license." }, 500);
  }
});
