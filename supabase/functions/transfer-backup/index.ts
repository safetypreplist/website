import { json, preflight } from "../_shared/http.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import {
  MAX_BACKUP_BYTES,
  MAX_BACKUPS_PER_DAY,
  TRANSFER_TTL_MS,
  licenseDeviceActive,
  purgeExpiredTransferBackups,
  requireLicenseByKey,
  sha256Hex,
} from "../_shared/transfer.ts";

type Action = "create" | "status" | "download" | "cleanup";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`transfer-backup:${clientIp(req)}`, 40, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "status") as Action;
    const key = String(body.key || "");
    const deviceId = String(body.deviceId || "").trim();
    const { admin, license } = await requireLicenseByKey(key);
    if (!license) return json({ error: "That license key is not valid." }, 403);

    await purgeExpiredTransferBackups(admin, license.id);

    if (action === "cleanup") {
      return json({ ok: true });
    }

    if (action === "status") {
      const { data } = await admin
        .from("license_transfer_backups")
        .select("id, created_at, expires_at, byte_size")
        .eq("license_id", license.id)
        .is("deleted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(5);
      return json({
        ok: true,
        backups: (data || []).map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          byteSize: row.byte_size,
        })),
      });
    }

    if (action === "create") {
      if (!deviceId) return json({ error: "Device id is required." }, 400);
      const active = await licenseDeviceActive(admin, license.id, deviceId);
      if (!active) {
        return json({ error: "Activate this license on this device before creating a cloud backup." }, 403);
      }

      const payload = body.payload;
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
      if (!raw || raw === "null") return json({ error: "Backup payload is required." }, 400);
      const bytes = new TextEncoder().encode(raw);
      if (bytes.length > MAX_BACKUP_BYTES) {
        return json({ error: "That backup is too large. Download a backup file instead." }, 413);
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recent = await admin
        .from("license_transfer_backups")
        .select("id", { count: "exact", head: true })
        .eq("license_id", license.id)
        .gte("created_at", since);
      if ((recent.count || 0) >= MAX_BACKUPS_PER_DAY) {
        return json({ error: "Cloud backup limit reached for today. Try again tomorrow or download a file." }, 429);
      }

      const backupId = crypto.randomUUID();
      const storagePath = `${license.id}/${backupId}.json`;
      const uploaded = await admin.storage.from("license-transfers").upload(storagePath, bytes, {
        contentType: "application/json",
        upsert: false,
      });
      if (uploaded.error) {
        console.error(uploaded.error);
        return json({ error: "Could not store that backup." }, 500);
      }

      const expiresAt = new Date(Date.now() + TRANSFER_TTL_MS).toISOString();
      const checksum = await sha256Hex(raw);
      const inserted = await admin.from("license_transfer_backups").insert({
        id: backupId,
        license_id: license.id,
        storage_path: storagePath,
        byte_size: bytes.length,
        checksum,
        expires_at: expiresAt,
        created_from_device_id: deviceId,
      });
      if (inserted.error) {
        console.error(inserted.error);
        await admin.storage.from("license-transfers").remove([storagePath]);
        return json({ error: "Could not save backup metadata." }, 500);
      }

      return json({
        ok: true,
        backup: { id: backupId, createdAt: new Date().toISOString(), expiresAt, byteSize: bytes.length },
      });
    }

    if (action === "download") {
      if (!deviceId) return json({ error: "Device id is required." }, 400);
      const active = await licenseDeviceActive(admin, license.id, deviceId);
      if (!active) {
        return json({ error: "Activate this license on this device before restoring a cloud backup." }, 403);
      }

      const backupId = String(body.backupId || "").trim();
      let query = admin
        .from("license_transfer_backups")
        .select("id, storage_path, expires_at, deleted_at")
        .eq("license_id", license.id)
        .is("deleted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (backupId) query = query.eq("id", backupId);
      const { data: rows, error } = await query;
      if (error) {
        console.error(error);
        return json({ error: "Could not load that backup." }, 500);
      }
      const row = rows?.[0];
      if (!row) return json({ error: "No active cloud backup was found for this license (or it expired)." }, 404);

      const downloaded = await admin.storage.from("license-transfers").download(row.storage_path);
      if (downloaded.error || !downloaded.data) {
        console.error(downloaded.error);
        return json({ error: "Could not download that backup." }, 500);
      }
      const text = await downloaded.data.text();
      return json({ ok: true, backupId: row.id, expiresAt: row.expires_at, payload: JSON.parse(text) });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Could not process transfer backup." }, 500);
  }
});
