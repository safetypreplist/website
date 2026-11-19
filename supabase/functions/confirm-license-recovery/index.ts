import { json, preflight } from "../_shared/http.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sha256Hex } from "../_shared/transfer.ts";

type RecoveredLicense = {
  licenseKey: string;
  product: "basic" | "pro";
  deviceActive: boolean;
};

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`confirm-recover:${clientIp(req)}`, 20, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = String(body.token || "").trim();
    if (!token || token.length < 32) {
      return json({ error: "That recovery link is not valid or has expired." }, 400);
    }

    const admin = serviceClient();
    const tokenHash = await sha256Hex(token);
    const { data: row, error } = await admin
      .from("license_recovery_tokens")
      .select("id, email_normalized, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) {
      console.error(error);
      return json({ error: "Could not verify that recovery link." }, 500);
    }
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return json({ error: "That recovery link is not valid or has expired." }, 400);
    }

    const { data: licenses, error: licenseError } = await admin.rpc("licenses_for_email", {
      p_email: row.email_normalized,
    });
    if (licenseError) {
      console.error(licenseError);
      return json({ error: "Could not verify that recovery link." }, 500);
    }

    const rows = (Array.isArray(licenses) ? licenses : []) as Array<{
      id: string;
      license_key: string;
      product: "basic" | "pro";
      status: string;
    }>;

    if (!rows.length) {
      return json({ error: "That recovery link is not valid or has expired." }, 400);
    }

    const recovered: RecoveredLicense[] = [];
    for (const license of rows) {
      const { data: devices } = await admin
        .from("license_devices")
        .select("device_id")
        .eq("license_id", license.id)
        .limit(1);
      recovered.push({
        licenseKey: license.license_key,
        product: license.product === "pro" ? "pro" : "basic",
        deviceActive: Boolean(devices?.length),
      });
    }

    const marked = await admin
      .from("license_recovery_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null);
    if (marked.error) console.error(marked.error);

    console.log(
      JSON.stringify({
        event: "license_recovery_confirmed",
        email: row.email_normalized,
        count: recovered.length,
        at: new Date().toISOString(),
      }),
    );

    return json({
      ok: true,
      licenses: recovered,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not verify that recovery link." }, 500);
  }
});
