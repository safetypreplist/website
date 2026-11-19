import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { getLicense, isLicensed } from "../lib/licenseClient";
import { PHOTO_LIBRARY } from "../lib/photos";
import { invokeFunction } from "../lib/supabase";
import { downloadTransferBackupFile } from "../lib/transferBackup";

type Ack = "backed_up" | "skip" | "";
type Step = "backup" | "request" | "check_email";

export function DeactivatePage() {
  const [params] = useSearchParams();
  const local = getLicense();
  const keyFromUrl = useMemo(() => (params.get("key") || "").trim(), [params]);
  const [step, setStep] = useState<Step>("backup");
  const [key, setKey] = useState(keyFromUrl || local?.key || "");
  const [ack, setAck] = useState<Ack>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileBackupOk, setFileBackupOk] = useState(false);
  const [emailMasked, setEmailMasked] = useState<string | null>(null);

  async function downloadFileBackup() {
    setBusy(true);
    setError(null);
    try {
      await downloadTransferBackupFile();
      setFileBackupOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download a backup file.");
    } finally {
      setBusy(false);
    }
  }

  function openCloudBackup() {
    const href = isLicensed() ? "/app/transfer?mode=backup" : "/activate";
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function requestDeactivation(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await invokeFunction<{ ok?: boolean; emailMasked?: string | null; message?: string }>(
        "request-deactivate-license",
        { key: key.trim() },
      );
      setEmailMasked(data.emailMasked || null);
      setStep("check_email");
    } catch (err) {
      // Still advance with generic copy so we do not leak whether the key exists.
      setEmailMasked(null);
      setStep("check_email");
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
      <main className="license-gate-shell">
        <section className="license-gate-panel">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">Device transfer</p>
          <h1>Deactivate &amp; transfer</h1>

          {step === "backup" ? (
            <>
              <div className="license-gate-notice" role="status">
                <strong>IMPORTANT: Back up your data before deactivating</strong>
                <p style={{ margin: "8px 0 0" }}>
                  Your personalized checklists, notes, completed items, and saved information are stored on this device.
                  If you deactivate without a backup, your new device may start with blank checklists.
                </p>
              </div>

              <div className="license-transfer-options">
                <article>
                  <h2>Option A: Back Up to SafetyPrepList Cloud</h2>
                  <p>Creates a temporary cloud backup that stays available for 48 hours.</p>
                  <button className="btn btn-primary" type="button" onClick={openCloudBackup}>
                    Back Up to SafetyPrepList Cloud
                  </button>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Opens Transfer My Data in a new tab. Come back here after the app confirms the backup succeeded.
                  </p>
                </article>
                <article>
                  <h2>Option B: Download a Backup File</h2>
                  <p>Save a file you can move to your new device (AirDrop, email, USB, cloud drive).</p>
                  <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void downloadFileBackup()}>
                    {busy ? "Preparing…" : "Download My Backup File"}
                  </button>
                  {fileBackupOk ? (
                    <p className="muted" style={{ marginTop: 8 }} role="status">
                      Backup file downloaded. Keep it somewhere you can open from the new device.
                    </p>
                  ) : null}
                </article>
              </div>

              <fieldset className="license-ack">
                <legend>Before you continue</legend>
                <label>
                  <input
                    type="radio"
                    name="ack"
                    checked={ack === "backed_up"}
                    onChange={() => setAck("backed_up")}
                  />
                  I have successfully backed up my data.
                </label>
                <label>
                  <input type="radio" name="ack" checked={ack === "skip"} onChange={() => setAck("skip")} />
                  I understand that if I continue without a backup, my new device will have blank checklists. I do not
                  need to transfer my existing data.
                </label>
              </fieldset>

              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={!ack}
                onClick={() => {
                  setError(null);
                  setStep("request");
                }}
              >
                Continue to License Deactivation
              </button>
            </>
          ) : null}

          {step === "request" ? (
            <>
              <p className="license-gate-lead">
                Enter your license key. We’ll email a one-time confirmation link to the address from your purchase. Your
                license is not released until you confirm that email.
              </p>
              <form onSubmit={(e) => void requestDeactivation(e)} className="license-gate-form">
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
                  />
                </label>
                {error ? (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="btn btn-primary btn-block" type="submit" disabled={busy || !key.trim()}>
                  {busy ? "Sending…" : "Email me a confirmation link"}
                </button>
                <button className="btn btn-ghost btn-block" type="button" onClick={() => setStep("backup")}>
                  Back
                </button>
              </form>
            </>
          ) : null}

          {step === "check_email" ? (
            <div className="license-gate-success" role="status">
              <p className="eyebrow">Check your email</p>
              <h2>Confirm License Deactivation</h2>
              <p className="muted">
                If that license key is valid, we sent a verification link to the email address associated with your
                license
                {emailMasked ? (
                  <>
                    {" "}
                    (<strong>{emailMasked}</strong>)
                  </>
                ) : null}
                .
              </p>
              <p className="muted">
                Open the email and tap <strong>Confirm License Deactivation</strong>. The link works once and expires in
                24 hours. Your license stays active until you confirm.
              </p>
              <div className="license-gate-actions">
                <Link className="btn btn-primary" to="/transfer">
                  View transfer instructions
                </Link>
                <button className="btn btn-ghost" type="button" onClick={() => setStep("request")}>
                  Try another key
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <p className="muted license-gate-foot">
          Lost the purchase email? <Link to="/app/reset-devices">Reset devices</Link>
          {" · "}
          <Link to="/activate">Back to Activate</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
