import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useApp } from "../context/AppContext";
import { clearLocalLicense, getLicense, isLicensed } from "../lib/licenseClient";
import {
  backUpBeforeMove,
  describeSummary,
  findBackupToRestore,
  releaseThisDevice,
  timeAgo,
  type FoundBackup,
  type MoveBackup,
} from "../lib/moveLicense";
import {
  downloadTransferBackupFile,
  hasLocalPersonalData,
  parseTransferBackup,
  restoreTransferBackup,
  summarizeTransferBackup,
  type TransferBackupPayload,
} from "../lib/transferBackup";
import type { ActivateRouteState } from "./Activate";

type Phase = "idle" | "confirm" | "backingUp" | "releasing";

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function AppTransferPage() {
  const { refreshAccount, groupStatus } = useApp();
  const navigate = useNavigate();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const license = getLicense();
  const [phase, setPhase] = useState<Phase>("idle");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<FoundBackup | null>(null);
  const [pendingImport, setPendingImport] = useState<TransferBackupPayload | null>(null);

  const inGroup = groupStatus?.group?.status === "active";
  const moving = phase === "backingUp" || phase === "releasing";

  useEffect(() => {
    if (!license?.key || !online) return;
    let live = true;
    void findBackupToRestore(license.key).then((backup) => {
      if (live) setFound(backup);
    });
    return () => {
      live = false;
    };
  }, [license?.key, online]);

  if (!isLicensed() || !license) {
    return (
      <div className="transfer-page">
        <p className="eyebrow">Move to a new device</p>
        <h1 className="page-title">Activate this device first</h1>
        <Link className="btn btn-primary" to="/activate">
          Activate
        </Link>
      </div>
    );
  }

  const key = license.key;

  async function release(backup: MoveBackup) {
    setPhase("releasing");
    try {
      const released = await releaseThisDevice(key);
      if (!released) {
        clearLocalLicense();
        navigate(`/activate?reason=moved#key=${encodeURIComponent(key)}`, { replace: true });
        return;
      }
      const state: ActivateRouteState = { movedOut: { key, backup } };
      navigate("/activate", { replace: true, state });
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not move your license. Try again.");
    }
  }

  async function backUpAndMove() {
    setError(null);
    setBackupError(null);
    setPhase("backingUp");
    let backup: MoveBackup;
    try {
      backup = await backUpBeforeMove(key);
    } catch (err) {
      setPhase("idle");
      setBackupError(err instanceof Error ? err.message : "The cloud backup did not finish.");
      return;
    }
    await release(backup);
  }

  async function saveFileThenMove() {
    setError(null);
    try {
      await downloadTransferBackupFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save a backup file.");
      return;
    }
    setBackupError(null);
    await release({ kind: "file" });
  }

  async function exportFile() {
    setBusy(true);
    setError(null);
    try {
      const summary = await downloadTransferBackupFile();
      setMessage(`Backup file saved (${describeSummary(summary)}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save a backup file.");
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
      setFound(null);
      setMessage(`Restored ${describeSummary(summarizeTransferBackup(payload))}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore that backup.");
    } finally {
      setBusy(false);
    }
  }

  async function startImport(payload: TransferBackupPayload) {
    if (await hasLocalPersonalData()) setPendingImport(payload);
    else await applyImport(payload);
  }

  async function onFileSelected(e: FormEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setError(null);
    try {
      await startImport(parseTransferBackup(await file.text()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that backup file.");
    }
  }

  return (
    <div className="transfer-page">
      <header className="transfer-hero">
        <p className="eyebrow">Move to a new device</p>
        <h1 className="page-title">Move your license to a new device</h1>
        <p className="muted">Your license works on one device at a time. Moving takes about a minute and brings your checklist along.</p>
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

      {found ? (
        <section className="transfer-step-body move-restore-card">
          <h2>Restore your checklist here?</h2>
          <p>
            We found the backup from your other device, made {timeAgo(found.backup.createdAt)}:{" "}
            {describeSummary(found.summary)}.
          </p>
          <div className="transfer-step-actions">
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void startImport(found.payload)}>
              {busy ? "Restoring…" : "Restore my checklist"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="transfer-step-body move-card">
        <ol className="move-what-happens">
          <li>Your checklist is backed up for 48 hours.</li>
          <li>This device lets go of your license.</li>
          <li>You open the code or link on the new device, then restore.</li>
        </ol>
        {inGroup ? <p className="muted">Your Group Sharing membership moves with your license.</p> : null}

        {backupError ? (
          <div className="move-backup-failed" role="alert">
            <p>
              <strong>The backup didn&apos;t finish.</strong> {backupError}
            </p>
            <div className="transfer-step-actions">
              <button className="btn btn-primary" type="button" disabled={moving || !online} onClick={() => void backUpAndMove()}>
                Try again
              </button>
              <button className="btn btn-ghost" type="button" disabled={moving || !online} onClick={() => void saveFileThenMove()}>
                Save a backup file, then move
              </button>
              <button className="btn btn-ghost" type="button" disabled={moving || !online} onClick={() => void release({ kind: "none" })}>
                Move without a backup
              </button>
            </div>
          </div>
        ) : (
          <div className="transfer-step-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={moving || !online}
              onClick={() => setPhase("confirm")}
            >
              {phase === "backingUp" ? "Backing up…" : phase === "releasing" ? "Moving…" : "Back up and move"}
            </button>
          </div>
        )}
        {!online ? <p className="muted">Moving needs an internet connection. Your checklist still works offline.</p> : null}
      </section>

      <details className="move-more">
        <summary>Other backup options</summary>
        <div className="transfer-step-actions">
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void exportFile()}>
            Save a backup file
          </button>
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            Restore from a file
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFileSelected(e)} />
      </details>

      {phase === "confirm" ? (
        <ConfirmDialog
          title="Move your license off this device?"
          body="We back up your checklist first. Then this device can't open your checklist until you move the license back."
          confirmLabel="Back up and move"
          onClose={() => setPhase("idle")}
          onConfirm={() => void backUpAndMove()}
        />
      ) : null}

      {pendingImport ? (
        <ConfirmDialog
          title="Replace what's on this device?"
          body={`The backup (${describeSummary(summarizeTransferBackup(pendingImport))}) replaces the checklist on this device.`}
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
