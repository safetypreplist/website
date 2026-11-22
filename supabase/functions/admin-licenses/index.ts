import { json, preflight } from "../_shared/http.ts";
import { normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

function secretAuthorized(req: Request, body: Record<string, unknown>) {
  const expected = Deno.env.get("ADMIN_SECRET") || "";
  if (!expected || expected.length < 16) return false;
  const header = req.headers.get("x-admin-secret") || "";
  const fromBody = String(body.adminSecret || "");
  return header === expected || fromBody === expected;
}

async function ownerAuthorized(req: Request) {
  const { user } = await requireUser(req);
  if (!user) return false;
  const admin = serviceClient();
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "owner";
}

async function adminAuthorized(req: Request, body: Record<string, unknown>) {
  if (secretAuthorized(req, body)) return true;
  return await ownerAuthorized(req);
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

      const groups: Array<Record<string, unknown>> = [];
      const { data: groupRows } = await admin
        .from("sharing_groups")
        .select("id, name, status, max_devices, duration_days, expires_at, created_at, host_license_id")
        .order("created_at", { ascending: false })
        .limit(100);
      for (const group of groupRows || []) {
        const g = group as {
          id: string;
          name: string | null;
          status: string;
          max_devices: number;
          duration_days: number;
          expires_at: string | null;
          created_at: string;
          host_license_id: string;
        };
        const host = await admin
          .from("licenses")
          .select("license_key, email")
          .eq("id", g.host_license_id)
          .maybeSingle();
        const { count: memberCount } = await admin
          .from("sharing_group_members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", g.id)
          .in("invite_status", ["accepted", "pending"]);
        groups.push({
          id: g.id,
          name: g.name,
          status: g.status,
          max_devices: g.max_devices,
          duration_days: g.duration_days,
          expires_at: g.expires_at,
          created_at: g.created_at,
          host_license_key: (host.data as { license_key?: string } | null)?.license_key || null,
          host_email: (host.data as { email?: string | null } | null)?.email || null,
          member_count: memberCount ?? 0,
        });
      }

      return json({ licenses: withCounts, groups });
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
