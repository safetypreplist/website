import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { activate, getLicense, isLicensed } from "../lib/licenseClient";

const DEVICE_TAKEN =
  "This license is already active on another device. If that's your device, open Safety Prep List there and reset it from Reset devices. If you've lost that device, use Reset devices.";

export function ActivatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const existing = getLicense();
  const keyFromUrl = useMemo(() => (params.get("key") || "").trim(), [params]);
  const urlKeyNorm = keyFromUrl.toUpperCase();
  const existingKeyNorm = (existing?.key || "").toUpperCase();
  const switchingKey = Boolean(urlKeyNorm && existing && urlKeyNorm !== existingKeyNorm);

  const [key, setKey] = useState(keyFromUrl || existing?.key || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceTaken, setDeviceTaken] = useState(false);

  if (isLicensed() && existing && !switchingKey) {
    return (
      <div className="public-page">
        <PublicHeader />
        <main className="wrap auth-card" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 480 }}>
          <p className="eyebrow">Already activated</p>
          <h1>This device has a license</h1>
          <p className="muted">One license covers one device. This device is ready to use.</p>
          <div className="panel" style={{ marginTop: 18 }}>
            <p>
              <strong>Product:</strong> {existing.product === "pro" ? "Pro" : "Basic"}
            </p>
            <p>
              <strong>Key:</strong> <code>{existing.key}</code>
            </p>
          </div>
          <div className="toolbar" style={{ gap: 10, marginTop: 18 }}>
            <Link className="btn btn-primary" to="/app">
              Open checklists
            </Link>
            <Link className="btn btn-ghost" to="/license">
              License details
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

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
      setDeviceTaken(message.toLowerCase().includes("already active on another device"));
      setBusy(false);
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="wrap auth-card" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 480 }}>
        <p className="eyebrow">License</p>
        <h1>{switchingKey ? "Activate another license" : "Activate your checklist"}</h1>
        <p className="muted">
          {switchingKey
            ? "This device already has a license. Activating a different key replaces it on this device. For a second device, activate that key there instead."
            : "Enter the license key from your purchase email. One license covers one device."}
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="stack" style={{ gap: 14, marginTop: 22 }}>
          <label>
            License key
            <input
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
                  <Link to="/app/reset-devices">Reset devices</Link>
                </p>
              ) : null}
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy || !key.trim()}>
            {busy ? "Activating…" : "Activate"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 18 }}>
          Lost access to your device? <Link to="/app/reset-devices">Reset devices</Link>
          {" · "}
          <Link to="/license">License details</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
