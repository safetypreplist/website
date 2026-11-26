import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose, type LicenseRow } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { retrieveCheckoutSession } from "../_shared/fulfill.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = normalizeLicenseKeyLoose(String(body.key || body.licenseKey || ""));
    // Households share one IP: keep a roomy network-wide cap plus a per-license cap.
    const ip = clientIp(req);
    const limited =
      (await rateLimitBlock(`license-status:${ip}`, 120, 600)) ||
      (await rateLimitBlock(`license-status:${ip}:${key.slice(0, 40)}`, 40, 600));
    if (limited) return limited;

    if (!key.startsWith("SPL-")) return json({ error: "That license key is not valid." }, 403);

    const admin = serviceClient();
    let license = await findLicenseByKey(admin, key);
    if (!license || license.status !== "active") {
      return json({ error: "That license key is not valid." }, 403);
    }

    const action = String(body.action || "status");
    if (action === "update_contact") {
      const deviceId = String(body.deviceId || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      if (!deviceId || deviceId.length > 128) {
        return json({ error: "Activated device is required to update contact email." }, 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Enter a valid email address." }, 400);
      }
      const device = await admin
        .from("license_devices")
        .select("device_id")
        .eq("license_id", license.id)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (!device.data) {
        return json({ error: "Open Profile on the device where this license is activated." }, 403);
      }
      const updated = await admin
        .from("licenses")
        .update({ email })
        .eq("id", license.id)
        .select("id, email")
        .maybeSingle();
      if (!updated.data) return json({ error: "Could not save contact email." }, 500);
      return json({ ok: true, email: (updated.data as { email: string | null }).email });
    }

    if (license.amount_cents == null && license.stripe_session_id) {
      const session = await retrieveCheckoutSession(license.stripe_session_id);
      const amount = typeof session?.amount_total === "number" ? session.amount_total : null;
      if (amount != null) {
        const { data } = await admin
          .from("licenses")
          .update({ amount_cents: amount })
          .eq("id", license.id)
          .is("amount_cents", null)
          .select("*")
          .maybeSingle();
        if (data) license = data as LicenseRow;
        else license = { ...license, amount_cents: amount };
      }
    }

    const { data: devices } = await admin
      .from("license_devices")
      .select("device_id, activated_at")
      .eq("license_id", license.id)
      .order("activated_at", { ascending: true });

    return json({
      product: license.product,
      amountCents: license.amount_cents,
      purchasedAt: license.created_at,
      licenseKey: license.license_key,
      devices: ((devices || []) as Array<{ device_id: string; activated_at: string }>).map((row) => ({
        deviceId: row.device_id,
        activatedAt: row.activated_at,
      })),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not look up that license." }, 500);
  }
});
