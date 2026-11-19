import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useApp } from "../context/AppContext";
import { getDeviceId, getLicense, isLicensed } from "../lib/licenseClient";
import { invokeFunction } from "../lib/supabase";
import {
  buildTransferBackup,
  downloadTransferBackupFile,
  hasLocalPersonalData,
  parseTransferBackup,
  restoreTransferBackup,
  summarizeTransferBackup,
  transferBackupByteSize,
  transferBackupToJson,
  type TransferBackupPayload,
  type TransferBackupSummary,
} from "../lib/transferBackup";

type CloudBackup = { id: string; createdAt: string; expiresAt: string; byteSize: number };

export function AppTransferPage() {
  const { refreshAccount } = useApp();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "";
  const fileRef = useRef<HTMLInputElement>(null);
  const license = getLicense();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloudOk, setCloudOk] = useState(false);
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [pendingImport, setPendingImport] = useState<TransferBackupPayload | null>(null);
  const [importSummary, setImportSummary] = useState<TransferBackupSummary | null>(null);
  const [hasLocal, setHasLocal] = useState(false);

  async function refreshStatus() {
    if (!license?.key) return;
    try {
      const data = await invokeFunction<{ backups?: CloudBackup[] }>("transfer-backup", {
        action: "status",
        key: license.key,
      });
      setBackups(data.backups || []);
    } catch {
      // Keep page usable offline for file export/import.
    }
  }

  useEffect(() => {
    void hasLocalPersonalData().then(setHasLocal);
    void refreshStatus();
  }, [license?.key]);

  useEffect(() => {
    if (mode === "backup" && isLicensed()) {
      const el = document.getElementById("cloud-backup");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [mode]);

  async function backupToCloud() {
    if (!license?.key) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setCloudOk(false);
    try {
      const payload = await buildTransferBackup();
      const size = transferBackupByteSize(payload);
      if (size > 1_500_000) throw new Error("That backup is too large for cloud storage. Download a file instead.");
      const data = await invokeFunction<{ backup?: CloudBackup }>("transfer-backup", {
        action: "create",
        key: license.key,
        deviceId: getDeviceId(),
        payload: JSON.parse(transferBackupToJson(payload)),
      });
      if (!data.backup) throw new Error("Cloud backup did not confirm successfully.");
      setCloudOk(true);
      setMessage(
        `Cloud backup saved. It stays available until ${new Date(data.backup.expiresAt).toLocaleString()}.`,
      );
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a cloud backup.");
    } finally {
      setBusy(false);
    }
  }

  async function exportFile() {
    setBusy(true);
    setError(null);
    try {
      const summary = await downloadTransferBackupFile();
      setMessage(
        `Backup file ready (${summary.progressCount} checklist items, ${summary.customCount} custom entries, ${summary.contactCount} contacts).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download a backup file.");
    } finally {
      setBusy(false);
    }
  }

  async function importFromCloud() {
    if (!license?.key) return;
    setBusy(true);
    setError(null);
    try {
      const data = await invokeFunction<{ payload?: unknown }>("transfer-backup", {
        action: "download",
        key: license.key,
        deviceId: getDeviceId(),
        backupId: backups[0]?.id,
      });
      const payload = parseTransferBackup(data.payload);
      setImportSummary(summarizeTransferBackup(payload));
      if (await hasLocalPersonalData()) {
        setPendingImport(payload);
      } else {
        await applyImport(payload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import from cloud.");
    } finally {
      setBusy(false);
    }
  }

  async function onFileSelected(e: FormEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const payload = parseTransferBackup(text);
      setImportSummary(summarizeTransferBackup(payload));
      if (await hasLocalPersonalData()) {
        setPendingImport(payload);
      } else {
        await applyImport(payload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that backup file.");
    } finally {
      setBusy(false);
    }
  }

  async function applyImport(payload: TransferBackupPayload) {
    setBusy(true);
    setError(null);
    try {
      await restoreTransferBackup(payload);
      await refreshAccount();
      setHasLocal(true);
      setPendingImport(null);
      const summary = summarizeTransferBackup(payload);
      setMessage(
        `Import complete: ${summary.progressCount} checklist items, ${summary.customCount} custom entries, ${summary.contactCount} contacts.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore that backup.");
    } finally {
      setBusy(false);
    }
  }

  if (!isLicensed() || !license) {
    return (
      <div className="wrap" style={{ padding: "32px 16px" }}>
        <p className="eyebrow">Transfer My Data</p>
        <h1>Activate first</h1>
        <p className="muted">Activate your license on this device, then return here to back up or restore personal data.</p>
        <Link className="btn btn-primary" to="/activate">
          Activate
        </Link>
      </div>
    );
  }

  return (
    <div className="transfer-page">
      <p className="eyebrow">License</p>
      <h1>Transfer My Data</h1>
      <p className="muted">
        Back up personalized checklists before you move devices, or restore them after you activate on a new device.
        License activation stays separate from data transfer. Cloud backups expire after 48 hours.
      </p>

      {message ? (
        <p className="panel" role="status" style={{ marginTop: 16 }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      ) : null}
      {cloudOk ? (
        <p className="panel" role="status" style={{ marginTop: 12 }}>
          Cloud backup confirmed successfully.
        </p>
      ) : null}

      <div className="transfer-grid">
        <section id="cloud-backup" className="panel">
          <h2>Back Up to SafetyPrepList Cloud</h2>
          <p className="muted">Temporary private backup tied to this license. Available for 48 hours.</p>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void backupToCloud()}>
            {busy ? "Working…" : "Back Up to SafetyPrepList Cloud"}
          </button>
          {backups[0] ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Latest cloud backup expires {new Date(backups[0].expiresAt).toLocaleString()}.
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>
              No active cloud backup on file.
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Import from SafetyPrepList Cloud</h2>
          <p className="muted">Restores the latest unexpired backup for this license onto this device.</p>
          <button className="btn btn-ghost" type="button" disabled={busy || !backups[0]} onClick={() => void importFromCloud()}>
            Import from SafetyPrepList Cloud
          </button>
        </section>

        <section className="panel">
          <h2>Export a Backup File</h2>
          <p className="muted">Download a JSON file you can move yourself (AirDrop, email, drive, USB).</p>
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void exportFile()}>
            Export a Backup File
          </button>
        </section>

        <section className="panel">
          <h2>Import a Backup File</h2>
          <p className="muted">Choose a Safety Prep List backup file saved from another device.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFileSelected(e)} />
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            Import a Backup File
          </button>
        </section>
      </div>

      <p className="muted" style={{ marginTop: 18 }}>
        {hasLocal
          ? "This device currently has personalized checklist data."
          : "This device does not have personalized checklist data yet."}{" "}
        Need to free the license? <Link to="/deactivate">Deactivate &amp; transfer</Link>
      </p>

      {pendingImport && importSummary ? (
        <ConfirmDialog
          title="Replace data on this device?"
          body={`This will replace the personalized checklists on this device with the backup (${importSummary.progressCount} items, ${importSummary.customCount} custom entries, ${importSummary.contactCount} contacts). Continue only if you want the backup to overwrite what is here.`}
          confirmLabel="Replace with backup"
          danger
          busy={busy}
          onClose={() => {
            if (!busy) setPendingImport(null);
          }}
          onConfirm={() => void applyImport(pendingImport)}
        />
      ) : null}
    </div>
  );
}
