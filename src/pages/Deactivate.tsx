import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { getLicense, isLicensed } from "../lib/licenseClient";
import { PHOTO_LIBRARY } from "../lib/photos";
import { invokeFunction } from "../lib/supabase";
import { downloadTransferBackupFile } from "../lib/transferBackup";

type BackupPhase = "ask" | "help" | "skip_ack" | "ready";
type BackupDecision = "backed_up" | "skipped";
type BackupMethod = "cloud" | "file" | "none";
type FlowStep = "deactivate" | "check_email";

const BACKUP_DECISION_KEY = "spl.deactivateBackupDecision.v1";

function recordBackupDecision(decision: BackupDecision, method: BackupMethod) {
  try {
    localStorage.setItem(
      BACKUP_DECISION_KEY,
      JSON.stringify({ decision, method, at: new Date().toISOString() }),
    );
  } catch {
    /* private mode */
  }
}

export function DeactivatePage() {
  const [params] = useSearchParams();
  const local = getLicense();
  const keyFromUrl = useMemo(() => (params.get("key") || "").trim(), [params]);
  const [backupPhase, setBackupPhase] = useState<BackupPhase>("ask");
  const [backupDecision, setBackupDecision] = useState<BackupDecision | null>(null);
  const [backupMethod, setBackupMethod] = useState<BackupMethod | null>(null);
  const [skipAck, setSkipAck] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>("deactivate");
  const [key, setKey] = useState(keyFromUrl || local?.key || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileBackupOk, setFileBackupOk] = useState(false);
  const [cloudBackupAck, setCloudBackupAck] = useState(false);
  const [emailMasked, setEmailMasked] = useState<string | null>(null);

  const ready = backupPhase === "ready" && Boolean(backupDecision);

  async function downloadFileBackup() {
    setBusy(true);
    setError(null);
    try {
      await downloadTransferBackupFile();
      setFileBackupOk(true);
      setCloudBackupAck(false);
      setBackupMethod("file");
    } catch (err) {
      setFileBackupOk(false);
      setError(err instanceof Error ? err.message : "Could not download a backup file.");
    } finally {
      setBusy(false);
    }
  }

  function openCloudBackup() {
    setBackupMethod("cloud");
    setFileBackupOk(false);
    setCloudBackupAck(false);
    const href = isLicensed() ? "/app/transfer?mode=backup" : "/activate";
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function continueAfterBackup() {
    const fileOk = backupMethod === "file" && fileBackupOk;
    const cloudOk = backupMethod === "cloud" && cloudBackupAck;
    if (!fileOk && !cloudOk) {
      setError(
        "Complete a backup first: download a file until you see confirmation, or finish cloud backup in Transfer and check the confirmation box.",
      );
      return;
    }
    const method: BackupMethod = fileOk ? "file" : "cloud";
    setBackupMethod(method);
    setBackupDecision("backed_up");
    recordBackupDecision("backed_up", method);
    setError(null);
    setBackupPhase("ready");
  }

  function continueAfterSkip() {
    if (!skipAck) {
      setError("Please confirm you understand your data may not transfer.");
      return;
    }
    setBackupMethod("none");
    setBackupDecision("skipped");
    recordBackupDecision("skipped", "none");
    setError(null);
    setBackupPhase("ready");
  }

  async function requestDeactivation(e: FormEvent) {
    e.preventDefault();
    if (!backupDecision) {
      setError("Choose a backup option before deactivating.");
      setBackupPhase("ask");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await invokeFunction<{ ok?: boolean; emailMasked?: string | null; message?: string }>(
        "request-deactivate-license",
        {
          key: key.trim(),
          backupDecision,
          backupMethod: backupMethod || (backupDecision === "skipped" ? "none" : "unknown"),
        },
      );
      setEmailMasked(data.emailMasked || null);
      setFlowStep("check_email");
    } catch (err) {
      setEmailMasked(null);
      setFlowStep("check_email");
      if (err instanceof Error && err.message.toLowerCase().includes("rate")) {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-stage license-gate">
      <div
        className="checkout-bg license-gate-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <main className="license-gate-shell license-deactivate-shell">
        <div className={`license-deactivate-layout${!ready ? " is-deciding" : ""}`}>
          {!ready ? (
            <aside className="license-backup-bubble" aria-live="polite">
              {backupPhase === "ask" ? (
                <>
                  <p className="license-backup-kicker">Before you continue</p>
                  <h2>IMPORTANT: Back Up Your Data Before Deactivating</h2>
                  <p>
                    Checklists, notes, and progress stay on this device. Deactivating does not move that information by
                    itself.
                  </p>
                  <p className="license-backup-ask">Would you like help backing up your data before continuing?</p>
                  <div className="license-backup-choices">
                    <button
                      className="btn btn-primary btn-block"
                      type="button"
                      onClick={() => {
                        setError(null);
                        setBackupPhase("help");
                      }}
                    >
                      YES, HELP ME BACK UP MY DATA
                    </button>
                    <button
                      className="btn btn-ghost btn-block"
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSkipAck(false);
                        setBackupPhase("skip_ack");
                      }}
                    >
                      NO THANKS, CONTINUE WITHOUT BACKUP
                    </button>
                  </div>
                </>
              ) : null}

              {backupPhase === "help" ? (
                <>
                  <p className="license-backup-kicker">Free backups</p>
                  <h2>Choose Your Free Backup Option</h2>
                  <p>Both options are free. Pick one, then continue to deactivation.</p>

                  <div className="license-backup-options">
                    <article>
                      <h3>Free SafetyPrepList Cloud Backup</h3>
                      <p>Create a temporary cloud backup that remains available for 48 hours.</p>
                      <button className="btn btn-primary btn-block" type="button" onClick={openCloudBackup}>
                        Start cloud backup
                      </button>
                      <p className="muted">
                        Opens Transfer in a new tab. Come back here only after that tab confirms the backup succeeded.
                      </p>
                      {backupMethod === "cloud" ? (
                        <label className="license-backup-ack">
                          <input
                            type="checkbox"
                            checked={cloudBackupAck}
                            onChange={(event) => setCloudBackupAck(event.target.checked)}
                          />
                          <span>The Transfer tab confirmed my temporary cloud backup was created.</span>
                        </label>
                      ) : null}
                    </article>
                    <article>
                      <h3>Free Downloadable Backup</h3>
                      <p>Download a backup file and save it to your own device or storage.</p>
                      <button
                        className="btn btn-ghost btn-block"
                        type="button"
                        disabled={busy}
                        onClick={() => void downloadFileBackup()}
                      >
                        {busy ? "Preparing…" : "Download backup file"}
                      </button>
                      {fileBackupOk ? (
                        <p className="muted" role="status">
                          Backup file downloaded. Keep it somewhere you can open from your new device.
                        </p>
                      ) : null}
                    </article>
                  </div>

                  {error ? (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <div className="license-backup-choices">
                    <button className="btn btn-primary btn-block" type="button" onClick={continueAfterBackup}>
                      I&apos;ve Successfully Backed Up My Data — Continue
                    </button>
                    <button
                      className="btn btn-ghost btn-block"
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSkipAck(false);
                        setBackupPhase("skip_ack");
                      }}
                    >
                      Skip backup and continue
                    </button>
                    <button className="btn btn-ghost btn-block" type="button" onClick={() => setBackupPhase("ask")}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : null}

              {backupPhase === "skip_ack" ? (
                <>
                  <p className="license-backup-kicker">Continue without backup</p>
                  <h2>Confirm before deactivating</h2>
                  <p>
                    Deactivation frees your license for another device. It does not automatically transfer your
                    checklists, notes, or progress.
                  </p>
                  <label className="license-backup-ack">
                    <input
                      type="checkbox"
                      checked={skipAck}
                      onChange={(e) => {
                        setSkipAck(e.target.checked);
                        setError(null);
                      }}
                    />
                    <span>
                      I understand my data may not transfer and could be lost if I have not backed it up.
                    </span>
                  </label>
                  {error ? (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="license-backup-choices">
                    <button className="btn btn-primary btn-block" type="button" onClick={continueAfterSkip}>
                      Continue to deactivation
                    </button>
                    <button
                      className="btn btn-ghost btn-block"
                      type="button"
                      onClick={() => {
                        setError(null);
                        setBackupPhase("help");
                      }}
                    >
                      Help me back up instead
                    </button>
                    <button className="btn btn-ghost btn-block" type="button" onClick={() => setBackupPhase("ask")}>
                      Back
                    </button>
                  </div>
                </>
              ) : null}
            </aside>
          ) : null}

          <section className={`license-gate-panel${!ready ? " is-subdued" : ""}`}>
            <BrandMark className="brand-mark license-gate-mark" />
            <p className="eyebrow">Deactivate</p>
            <h1>Deactivate your license</h1>

            {flowStep === "deactivate" ? (
              <>
                <p className="license-gate-lead">
                  {ready
                    ? "Enter your license key. We’ll email a one-time confirmation link. Your license is not released until you confirm that email."
                    : "Answer the backup question first. Then you can request deactivation with your license key."}
                </p>

                {ready && backupDecision === "backed_up" ? (
                  <p className="license-gate-notice" role="status">
                    Backup decision recorded. Deactivation still does not move your checklists automatically — restore
                    them on the new device after you activate.
                  </p>
                ) : null}
                {ready && backupDecision === "skipped" ? (
                  <p className="license-gate-notice" role="status">
                    You chose to continue without a backup. You can still{" "}
                    <button
                      className="license-inline-link"
                      type="button"
                      onClick={() => {
                        setBackupPhase("help");
                        setBackupDecision(null);
                        setBackupMethod(null);
                        setFlowStep("deactivate");
                      }}
                    >
                      return to backup help
                    </button>
                    .
                  </p>
                ) : null}

                <form
                  onSubmit={(e) => void requestDeactivation(e)}
                  className="license-gate-form"
                  aria-disabled={!ready}
                >
                  <label className="field">
                    <span>License key</span>
                    <input
                      className="license-key-input"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="SPL-XXXX-XXXX-XXXX-XXXX"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      disabled={!ready}
                    />
                  </label>
                  {error && ready ? (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button
                    className="btn btn-primary btn-block"
                    type="submit"
                    disabled={!ready || busy || !key.trim()}
                  >
                    {busy ? "Sending…" : "Email me a confirmation link"}
                  </button>
                  {ready ? (
                    <button
                      className="btn btn-ghost btn-block"
                      type="button"
                      onClick={() => {
                        setBackupPhase("ask");
                        setBackupDecision(null);
                        setBackupMethod(null);
                        setSkipAck(false);
                        setFileBackupOk(false);
                        setError(null);
                      }}
                    >
                      Change backup decision
                    </button>
                  ) : null}
                </form>
                <p className="license-gate-assurance">One license · One device · Confirm by email</p>
              </>
            ) : null}

            {flowStep === "check_email" ? (
              <div className="license-gate-success" role="status">
                <p className="eyebrow">Check your email</p>
                <h2>Confirm deactivation</h2>
                <p className="muted">
                  If that license key is valid, we sent a verification link to the email on your purchase
                  {emailMasked ? (
                    <>
                      {" "}
                      (<strong>{emailMasked}</strong>)
                    </>
                  ) : null}
                  .
                </p>
                <p className="muted">
                  Open the email and tap <strong>Confirm License Deactivation</strong>. The link works once and expires
                  in 24 hours. Your license stays active until you confirm.
                </p>
                <div className="license-gate-actions">
                  <Link className="btn btn-primary" to="/activate">
                    Go to Activate
                  </Link>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setFlowStep("deactivate");
                      setError(null);
                    }}
                  >
                    Try another key
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <p className="muted license-gate-foot">
          <Link to="/activate">Activate</Link>
          {" · "}
          <Link to="/license-recovery">Forgot your key?</Link>
          {" · "}
          <Link to="/license">License details</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
