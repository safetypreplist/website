import { json, preflight } from "../_shared/http.ts";
import { normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import { serviceClient } from "../_shared/supabase.ts";

function adminAuthorized(req: Request, body: Record<string, unknown>) {
  const expected = Deno.env.get("ADMIN_SECRET") || "";
  if (!expected || expected.length < 16) return false;
  const header = req.headers.get("x-admin-secret") || "";
  const fromBody = String(body.adminSecret || "");
  return header === expected || fromBody === expected;
}

function logAdmin(action: string, licenseId: string) {
  console.log(
    JSON.stringify({
      event: `admin_license_${action}`,
      licenseId,
      at: new Date().toISOString(),
    }),
  );
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!adminAuthorized(req, body)) return json({ error: "Unauthorized" }, 401);

    const admin = serviceClient();
    const action = String(body.action || "list");

    if (action === "list") {
      const { data, error } = await admin
        .from("licenses")
        .select("id, license_key, product, status, email, devices_allowed, stripe_session_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.error(error);
        return json({ error: "Could not load licenses." }, 500);
      }
      const rows = data || [];
      const withCounts = [];
      for (const row of rows) {
        const id = (row as { id: string }).id;
        const { count } = await admin
          .from("license_devices")
          .select("device_id", { count: "exact", head: true })
          .eq("license_id", id);
        withCounts.push({ ...row, devices_used: count ?? 0 });
      }
      return json({ licenses: withCounts });
    }

    const licenseId = String(body.licenseId || "").trim();

    if (action === "deactivate") {
      if (!licenseId) return json({ error: "License id required." }, 400);
      const { data: license, error: findError } = await admin
        .from("licenses")
        .select("id, status")
        .eq("id", licenseId)
        .maybeSingle();
      if (findError) {
        console.error(findError);
        return json({ error: "Could not deactivate license." }, 500);
      }
      if (!license) return json({ error: "License not found." }, 404);

      const cleared = await admin.from("license_devices").delete().eq("license_id", licenseId);
      if (cleared.error) {
        console.error(cleared.error);
        return json({ error: "Could not deactivate license." }, 500);
      }
      logAdmin("deactivate", licenseId);
      return json({ ok: true, licenseId, devicesCleared: true });
    }

    if (action === "revoke") {
      if (!licenseId) {
        const key = normalizeLicenseKeyLoose(String(body.licenseKey || body.key || ""));
        if (!key.startsWith("SPL-")) return json({ error: "License id or key required." }, 400);
        const { data, error } = await admin
          .from("licenses")
          .update({ status: "revoked" })
          .eq("license_key", key)
          .select("id, license_key, status")
          .maybeSingle();
        if (error) {
          console.error(error);
          return json({ error: "Could not revoke license." }, 500);
        }
        if (!data) return json({ error: "License not found." }, 404);
        await admin.from("license_devices").delete().eq("license_id", (data as { id: string }).id);
        logAdmin("revoke", (data as { id: string }).id);
        return json({ ok: true, license: data });
      }

      const { data, error } = await admin
        .from("licenses")
        .update({ status: "revoked" })
        .eq("id", licenseId)
        .select("id, license_key, status")
        .maybeSingle();
      if (error) {
        console.error(error);
        return json({ error: "Could not revoke license." }, 500);
      }
      if (!data) return json({ error: "License not found." }, 404);
      await admin.from("license_devices").delete().eq("license_id", licenseId);
      logAdmin("revoke", licenseId);
      return json({ ok: true, license: data });
    }

    if (action === "restore") {
      if (!licenseId) return json({ error: "License id required." }, 400);
      const { data, error } = await admin
        .from("licenses")
        .update({ status: "active" })
        .eq("id", licenseId)
        .select("id, license_key, status")
        .maybeSingle();
      if (error) {
        console.error(error);
        return json({ error: "Could not restore license." }, 500);
      }
      if (!data) return json({ error: "License not found." }, 404);
      logAdmin("restore", licenseId);
      return json({ ok: true, license: data });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Admin request failed." }, 500);
  }
});
