import { json, preflight } from "../_shared/http.ts";
import { clientIp } from "../_shared/rateLimit.ts";
import { purgeExpiredTransferBackups } from "../_shared/transfer.ts";
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
  if (!user) return { ok: false as const, userId: null as string | null };
  const admin = serviceClient();
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "owner") return { ok: false as const, userId: null as string | null };
  return { ok: true as const, userId: user.id };
}

async function adminAuthorized(req: Request, body: Record<string, unknown>) {
  if (secretAuthorized(req, body)) return { ok: true as const, userId: null as string | null };
  return await ownerAuthorized(req);
}

function backupAvailability(row: {
  expires_at: string;
  deleted_at: string | null;
} | null) {
  if (!row) return { available: false, status: "none" as const };
  if (row.deleted_at) return { available: false, status: "deleted" as const };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { available: false, status: "expired" as const };
  return { available: true, status: "available" as const };
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const auth = await adminAuthorized(req, body);
    if (!auth.ok) return json({ error: "Unauthorized" }, 401);

    const admin = serviceClient();
    const action = String(body.action || "list");

    if (action === "list") {
      const query = String(body.query || "").trim().toLowerCase();
      const { data: tokens, error } = await admin
        .from("license_deactivation_tokens")
        .select(
          "id, license_id, created_at, expires_at, used_at, backup_decision, backup_method, request_ip",
        )
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) {
        console.error(error);
        return json({ error: "Could not load transfer activity." }, 500);
      }

      const rows = [];
      for (const token of tokens || []) {
        const { data: license } = await admin
          .from("licenses")
          .select(
            "id, license_key, product, status, email, stripe_session_id, created_at, last_deactivated_at",
          )
          .eq("id", token.license_id)
          .maybeSingle();
        if (!license) continue;

        const hay = `${license.license_key} ${license.email || ""} ${license.stripe_session_id || ""}`.toLowerCase();
        if (query && !hay.includes(query)) continue;

        await purgeExpiredTransferBackups(admin, license.id);

        const { data: backups } = await admin
          .from("license_transfer_backups")
          .select("id, created_at, expires_at, deleted_at, byte_size")
          .eq("license_id", license.id)
          .order("created_at", { ascending: false })
          .limit(3);

        const latestBackup = backups?.[0] || null;
        const availability = backupAvailability(latestBackup);

        const { count: deviceCount } = await admin
          .from("license_devices")
          .select("device_id", { count: "exact", head: true })
          .eq("license_id", license.id);

        let terms: { version: string | null; acceptedAt: string | null } = {
          version: null,
          acceptedAt: null,
        };
        if (license.email) {
          const { data: termRows } = await admin
            .from("terms_acceptances")
            .select("terms_version, accepted_at")
            .ilike("email", license.email)
            .order("accepted_at", { ascending: false })
            .limit(1);
          const termRow = termRows?.[0];
          if (termRow) {
            terms = {
              version: termRow.terms_version || null,
              acceptedAt: termRow.accepted_at || null,
            };
          }
        }

        let supportRequests: Array<{ id: string; message: string; createdAt: string }> = [];
        if (license.email) {
          const { data: tickets } = await admin
            .from("help_requests")
            .select("id, message, created_at")
            .ilike("email", license.email)
            .order("created_at", { ascending: false })
            .limit(8);
          supportRequests = (tickets || [])
            .filter((ticket) => {
              const msg = String(ticket.message || "").toLowerCase();
              return (
                msg.includes("transfer") ||
                msg.includes("deactivat") ||
                msg.includes("backup") ||
                msg.includes("device") ||
                msg.includes("license")
              );
            })
            .slice(0, 5)
            .map((ticket) => ({
              id: ticket.id,
              message: String(ticket.message || "").slice(0, 240),
              createdAt: ticket.created_at,
            }));
        }

        const { data: exports } = await admin
          .from("license_support_backup_exports")
          .select("id, backup_id, exported_at, assistance_recorded_at, assistance_note, deleted_at")
          .eq("license_id", license.id)
          .order("exported_at", { ascending: false })
          .limit(5);

        rows.push({
          tokenId: token.id,
          licenseId: license.id,
          licenseKey: license.license_key,
          product: license.product,
          email: license.email,
          purchaseRef: license.stripe_session_id,
          purchasedAt: license.created_at,
          transferRequestedAt: token.created_at,
          transferConfirmedAt: token.used_at,
          lastDeactivatedAt: license.last_deactivated_at || null,
          backupDecision: token.backup_decision || "unknown",
          backupMethod: token.backup_method || "unknown",
          backup: latestBackup
            ? {
                id: latestBackup.id,
                createdAt: latestBackup.created_at,
                expiresAt: latestBackup.expires_at,
                byteSize: latestBackup.byte_size,
                ...availability,
                status: availability.status,
              }
            : null,
          licenseStatus: license.status,
          devicesActive: deviceCount ?? 0,
          activationStatus:
            license.status !== "active"
              ? "revoked"
              : (deviceCount ?? 0) > 0
                ? "activated"
                : token.used_at
                  ? "awaiting_activation"
                  : "pending_deactivation",
          terms,
          supportRequests,
          supportExports: (exports || []).map((row) => ({
            id: row.id,
            backupId: row.backup_id,
            exportedAt: row.exported_at,
            assistanceRecordedAt: row.assistance_recorded_at,
            assistanceNote: row.assistance_note,
            deletedAt: row.deleted_at,
          })),
        });
      }

      return json({ ok: true, rows });
    }

    if (action === "exportBackup") {
      const licenseId = String(body.licenseId || "").trim();
      const backupId = String(body.backupId || "").trim();
      if (!licenseId) return json({ error: "License id required." }, 400);

      await purgeExpiredTransferBackups(admin, licenseId);

      let query = admin
        .from("license_transfer_backups")
        .select("id, storage_path, expires_at, deleted_at, byte_size")
        .eq("license_id", licenseId)
        .is("deleted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (backupId) query = query.eq("id", backupId);
      const { data: backups, error } = await query;
      if (error) {
        console.error(error);
        return json({ error: "Could not locate that backup." }, 500);
      }
      const backup = backups?.[0];
      if (!backup) {
        return json({ error: "No available cloud backup found for this license (it may have expired)." }, 404);
      }

      const downloaded = await admin.storage.from("license-transfers").download(backup.storage_path);
      if (downloaded.error || !downloaded.data) {
        console.error(downloaded.error);
        return json({ error: "Could not export that backup." }, 500);
      }

      const text = await downloaded.data.text();
      let payload: unknown = null;
      try {
        payload = JSON.parse(text);
      } catch {
        return json({ error: "Backup file is not valid JSON." }, 500);
      }

      const { data: exportRow, error: exportError } = await admin
        .from("license_support_backup_exports")
        .insert({
          license_id: licenseId,
          backup_id: backup.id,
          exported_by: auth.userId,
          request_ip: clientIp(req),
        })
        .select("id, exported_at")
        .maybeSingle();
      if (exportError) {
        console.error(exportError);
        return json({ error: "Exported file could not be audited. Aborting." }, 500);
      }

      console.log(
        JSON.stringify({
          event: "admin_transfer_backup_export",
          licenseId,
          backupId: backup.id,
          exportId: exportRow?.id,
          by: auth.userId,
          at: new Date().toISOString(),
        }),
      );

      return json({
        ok: true,
        exportId: exportRow?.id || null,
        exportedAt: exportRow?.exported_at || new Date().toISOString(),
        backupId: backup.id,
        expiresAt: backup.expires_at,
        byteSize: backup.byte_size,
        // Returned only for authorized, customer-requested support. Do not log payload contents.
        payload,
        notice:
          "Use this export only for customer-requested support, then record assistance and delete your local copy when finished.",
      });
    }

    if (action === "recordAssistance") {
      const exportId = String(body.exportId || "").trim();
      const note = String(body.note || "").trim().slice(0, 500);
      if (!exportId) return json({ error: "Export id required." }, 400);
      const { error } = await admin
        .from("license_support_backup_exports")
        .update({
          assistance_recorded_at: new Date().toISOString(),
          assistance_note: note || "Support assistance provided.",
        })
        .eq("id", exportId)
        .is("deleted_at", null);
      if (error) {
        console.error(error);
        return json({ error: "Could not record assistance." }, 500);
      }
      return json({ ok: true });
    }

    if (action === "completeSupportExport") {
      const exportId = String(body.exportId || "").trim();
      if (!exportId) return json({ error: "Export id required." }, 400);
      const { error } = await admin
        .from("license_support_backup_exports")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", exportId)
        .is("deleted_at", null);
      if (error) {
        console.error(error);
        return json({ error: "Could not mark that support export complete." }, 500);
      }
      console.log(
        JSON.stringify({
          event: "admin_transfer_support_complete",
          exportId,
          by: auth.userId,
          at: new Date().toISOString(),
        }),
      );
      return json({
        ok: true,
        message: "Support export marked complete. Delete any local copies of the customer backup file.",
      });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Could not complete that admin transfer action." }, 500);
  }
});
