import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { activate, isLicensed } from "../lib/licenseClient";

export function ActivatePage() {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLicensed()) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await activate(key);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate that license key.");
      setBusy(false);
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="wrap auth-card" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 480 }}>
        <p className="eyebrow">License</p>
        <h1>Activate your checklist</h1>
        <p className="muted">Enter the license key from your purchase email. No account needed.</p>
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
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy || !key.trim()}>
            {busy ? "Activating…" : "Activate"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 18 }}>
          Need to free a device slot? <Link to="/app/reset-devices">Reset devices</Link>
          {" · "}
          <Link to="/license">Look up a license</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
