import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ActivateQrDialog, useActivateQr } from "../components/ActivateQrDialog";
import { BrandMark } from "../components/Brand";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { activate, getLicense, isLicensed, takeActivateMessage } from "../lib/licenseClient";
import { PHOTO_LIBRARY } from "../lib/photos";

const DEVICE_TAKEN =
  "This license is active on another device. Deactivate it first, then activate here.";

function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="checkout-stage license-gate">
      <div
        className="checkout-bg license-gate-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <main className="license-gate-shell">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function ActivatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const existing = getLicense();
  const keyFromUrl = useMemo(() => (params.get("key") || "").trim(), [params]);
  const reason = (params.get("reason") || "").trim();
  const urlKeyNorm = keyFromUrl.toUpperCase();
  const existingKeyNorm = (existing?.key || "").toUpperCase();
  const switchingKey = Boolean(urlKeyNorm && existing && urlKeyNorm !== existingKeyNorm);

  const [key, setKey] = useState(keyFromUrl || existing?.key || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceTaken, setDeviceTaken] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPhoneQr, setShowPhoneQr] = useState(false);
  const phoneQr = useActivateQr(key.trim(), 168);
  const canShowPhoneQr = /^SPL-/i.test(key.trim());

  useEffect(() => {
    const stored = takeActivateMessage();
    if (stored) {
      setNotice(stored);
      return;
    }
    if (reason === "deactivated") {
      setNotice("This device is no longer activated. Enter your license key to activate it again.");
    } else if (reason === "moved") {
      setNotice("This license was moved. Enter your license key here to activate this device.");
    } else if (reason === "released") {
      setNotice("The previous device is free. Enter your license key to activate this one.");
    }
  }, [reason]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDeviceTaken(false);
    try {
      await activate(key);
      navigate("/app", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not activate that license key.";
      setError(message);
      setDeviceTaken(message.toLowerCase().includes("active on another device"));
      setBusy(false);
    }
  }

  const transferHref = key.trim() ? `/deactivate?key=${encodeURIComponent(key.trim())}` : "/deactivate";

  if (isLicensed() && existing && !switchingKey) {
    return (
      <GateShell>
        <section className="license-gate-panel">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">Ready on this device</p>
          <h1>Your license is active</h1>
          <p className="license-gate-lead">
            One license. One device. Lifetime access — ready offline whenever you need it.
          </p>
          <div className="license-gate-status">
            <div>
              <span>Plan</span>
              <strong>{existing.product === "pro" ? "Pro" : "Basic"}</strong>
            </div>
            <div>
              <span>License key</span>
              <code>{existing.key}</code>
            </div>
          </div>
          <div className="license-gate-actions">
            <Link className="btn btn-primary" to="/app">
              Open checklists
            </Link>
            <Link className="btn btn-ghost" to="/license">
              License details
            </Link>
          </div>
        </section>
          <aside className="license-transfer-card">
            <div>
              <p className="eyebrow">Already have a license?</p>
              <p>Need to deactivate it? Back up your data, then confirm deactivation by email.</p>
            </div>
            <Link className="btn btn-ghost" to="/deactivate">
              Need to deactivate it? Click here
            </Link>
          </aside>
      </GateShell>
    );
  }

  return (
    <GateShell>
      <section className="license-gate-panel">
        <BrandMark className="brand-mark license-gate-mark" />
        <p className="eyebrow">Lifetime license</p>
        <h1>{switchingKey ? "Activate another license" : "Activate your license"}</h1>
        <p className="license-gate-lead">
          {switchingKey
            ? "This device already has a license. Activating a different key replaces it here."
            : "Enter the key from your purchase email to unlock Safety Prep List on this device."}
        </p>

        {notice ? (
          <p className="license-gate-notice" role="status">
            {notice}
          </p>
        ) : null}

        <form onSubmit={(e) => void onSubmit(e)} className="license-gate-form">
          <label className="field">
            <span>Activation code</span>
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
            <div role="alert">
              <p className="form-error">{deviceTaken ? DEVICE_TAKEN : error}</p>
              {deviceTaken ? (
                <p className="muted" style={{ marginTop: 10 }}>
                  <Link to={transferHref}>Deactivate &amp; transfer</Link>
                </p>
              ) : null}
            </div>
          ) : null}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !key.trim()}>
            {busy ? "Activating…" : "Activate on this device now"}
          </button>
        </form>

        <div className="license-gate-phone">
          <p className="eyebrow">Need your phone instead?</p>
          <p className="muted">
            Activating binds this license to whichever device you confirm on. Prefer your phone? Scan the QR after
            entering your key — it opens Activate there with the key filled in.
          </p>
          {canShowPhoneQr ? (
            <button className="activate-qr-inline" type="button" onClick={() => setShowPhoneQr(true)}>
              <span className="activate-qr-inline-label">Open on phone</span>
              <span className="activate-qr-inline-frame">
                {phoneQr.qrSrc ? (
                  <img src={phoneQr.qrSrc} width={168} height={168} alt="" />
                ) : (
                  <span className="muted">Preparing…</span>
                )}
              </span>
              <span className="activate-qr-inline-cta">Scan to activate on phone</span>
            </button>
          ) : (
            <p className="muted">Enter your license key above to generate a phone QR.</p>
          )}
        </div>

        <p className="license-gate-assurance">Works offline after activation · One license, one device · No login account</p>
      </section>

        <p className="license-deactivate-link">
          <Link to={transferHref}>Already have a license? Need to deactivate it? Click here.</Link>
        </p>

      <p className="muted license-gate-foot">
        <Link to="/transfer">Transfer / Deactivate</Link>
        {" · "}
        <Link to="/license-recovery">Forgot your key?</Link>
        {" · "}
        <Link to="/license">License details</Link>
        {" · "}
        <Link to="/#pricing">Buy a license</Link>
      </p>
      {showPhoneQr && canShowPhoneQr ? (
        <ActivateQrDialog licenseKey={key.trim()} onClose={() => setShowPhoneQr(false)} />
      ) : null}
    </GateShell>
  );
}
