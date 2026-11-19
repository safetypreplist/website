import { json, preflight } from "../_shared/http.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sha256Hex } from "../_shared/transfer.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`confirm-deact:${clientIp(req)}`, 20, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = String(body.token || "").trim();
    if (!token || token.length < 32) {
      return json({ error: "That confirmation link is not valid or has expired." }, 400);
    }

    const admin = serviceClient();
    const tokenHash = await sha256Hex(token);
    const { data: row, error } = await admin
      .from("license_deactivation_tokens")
      .select("id, license_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) {
      console.error(error);
      return json({ error: "Could not confirm deactivation." }, 500);
    }
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return json({ error: "That confirmation link is not valid or has expired." }, 400);
    }

    const license = await admin.from("licenses").select("id, status, license_key").eq("id", row.license_id).maybeSingle();
    if (!license.data || license.data.status !== "active") {
      return json({ error: "That confirmation link is not valid or has expired." }, 400);
    }

    const deleted = await admin.from("license_devices").delete().eq("license_id", row.license_id);
    if (deleted.error) {
      console.error(deleted.error);
      return json({ error: "Could not deactivate that license." }, 500);
    }

    const marked = await admin
      .from("license_deactivation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null);
    if (marked.error) console.error(marked.error);

    await admin
      .from("licenses")
      .update({ last_deactivated_at: new Date().toISOString() })
      .eq("id", row.license_id);

    console.log(
      JSON.stringify({
        event: "license_deactivate_confirmed",
        licenseId: row.license_id,
        at: new Date().toISOString(),
      }),
    );

    return json({
      ok: true,
      deactivated: true,
      // Key returned only after successful email confirmation so the transfer page can guide activation.
      licenseKey: license.data.license_key,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not confirm deactivation." }, 500);
  }
});
