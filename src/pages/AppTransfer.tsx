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
    void refreshStatus();
  }, [license?.key]);

  useEffect(() => {
    if (mode === "backup" && isLicensed()) {
      document.getElementById("step-backup")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setMessage(`Cloud backup confirmed. Available until ${new Date(data.backup.expiresAt).toLocaleString()}.`);
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
        `Backup file downloaded (${summary.progressCount} items, ${summary.customCount} custom entries, ${summary.contactCount} contacts).`,
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
      if (await hasLocalPersonalData()) setPendingImport(payload);
      else await applyImport(payload);
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
      if (await hasLocalPersonalData()) setPendingImport(payload);
      else await applyImport(payload);
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
      setPendingImport(null);
      const summary = summarizeTransferBackup(payload);
      setMessage(
        `Import complete: ${summary.progressCount} items, ${summary.customCount} custom entries, ${summary.contactCount} contacts.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore that backup.");
    } finally {
      setBusy(false);
    }
  }

  if (!isLicensed() || !license) {
    return (
      <div className="transfer-page">
        <p className="eyebrow">Transfer / Deactivate</p>
        <h1 className="page-title">Activate this device first</h1>
        <p className="muted">Activate your license, then use this page to back up data or move to a new device.</p>
        <Link className="btn btn-primary" to="/activate">
          Activate
        </Link>
      </div>
    );
  }

  const deactivateHref = `/deactivate?key=${encodeURIComponent(license.key)}`;

  return (
    <div className="transfer-page">
      <header className="transfer-hero">
        <p className="eyebrow">Transfer / Deactivate</p>
        <h1 className="page-title">Move your license safely</h1>
        <p className="muted">
          Follow these four steps in order. Back up first, deactivate next, then activate and restore on the new device.
        </p>
      </header>

      {message ? (
        <p className="transfer-banner is-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="transfer-banner is-error" role="alert">
          {error}
        </p>
      ) : null}
      {cloudOk ? (
        <p className="transfer-banner is-success" role="status">
          Cloud backup confirmed successfully.
        </p>
      ) : null}

      <ol className="transfer-steps">
        <li id="step-backup" className="transfer-step">
          <div className="transfer-step-rail" aria-hidden="true">
            <span className="transfer-step-index">1</span>
          </div>
          <div className="transfer-step-body">
            <p className="transfer-step-label">Step 1</p>
            <h2>Back up your checklists</h2>
            <p>Save notes, checked items, and custom entries before you free the license.</p>
            <div className="transfer-step-actions">
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void backupToCloud()}>
                {busy ? "Working…" : "Back Up to SafetyPrepList Cloud"}
              </button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void exportFile()}>
                Download My Backup File
              </button>
            </div>
            <p className="muted">
              Cloud backups expire after 48 hours.
              {backups[0] ? ` Latest expires ${new Date(backups[0].expiresAt).toLocaleString()}.` : ""}
            </p>
          </div>
        </li>

        <li className="transfer-step">
          <div className="transfer-step-rail" aria-hidden="true">
            <span className="transfer-step-index">2</span>
          </div>
          <div className="transfer-step-body">
            <p className="transfer-step-label">Step 2</p>
            <h2>Deactivate this license</h2>
            <p>Confirm by email to free the license so it can activate on your new device.</p>
            <div className="transfer-step-actions">
              <Link className="btn btn-primary" to={deactivateHref}>
                Continue to Deactivate
              </Link>
            </div>
          </div>
        </li>

        <li className="transfer-step">
          <div className="transfer-step-rail" aria-hidden="true">
            <span className="transfer-step-index">3</span>
          </div>
          <div className="transfer-step-body">
            <p className="transfer-step-label">Step 3</p>
            <h2>Activate on the new device</h2>
            <p>Open Activate, enter the same license key, then come back here to restore your backup.</p>
            <div className="transfer-step-actions">
              <Link className="btn btn-ghost" to="/activate">
                Open Activate
              </Link>
            </div>
          </div>
        </li>

        <li className="transfer-step">
          <div className="transfer-step-rail" aria-hidden="true">
            <span className="transfer-step-index">4</span>
          </div>
          <div className="transfer-step-body">
            <p className="transfer-step-label">Step 4</p>
            <h2>Restore your data</h2>
            <p>Import from cloud or from the backup file you saved in step 1.</p>
            <div className="transfer-step-actions">
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy || !backups[0]}
                onClick={() => void importFromCloud()}
              >
                Import from SafetyPrepList Cloud
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => void onFileSelected(e)}
              />
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                Import a Backup File
              </button>
            </div>
          </div>
        </li>
      </ol>

      <p className="muted transfer-foot">
        Need license details? <Link to="/app/license">My license</Link>
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
