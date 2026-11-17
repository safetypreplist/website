import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { invokeFunction } from "../lib/supabase";

const GENERIC = "If that matches a purchase, your devices have been reset.";

export function ResetDevicesPage() {
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data = await invokeFunction<{ message?: string }>("reset-license", {
        key: key.trim(),
        email: email.trim(),
      });
      setMessage(data?.message || GENERIC);
    } catch {
      setMessage(GENERIC);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="wrap auth-card" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 480 }}>
        <p className="eyebrow">Devices</p>
        <h1>Reset your devices</h1>
        <p className="muted">
          Enter the email from your purchase and your license key. This clears activated devices so you can activate on a
          new phone or computer.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="stack" style={{ gap: 14, marginTop: 22 }}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
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
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Working…" : "Reset devices"}
          </button>
        </form>
        {message ? (
          <p role="status" style={{ marginTop: 18 }}>
            {message}
          </p>
        ) : null}
        <p className="muted" style={{ marginTop: 18 }}>
          <Link to="/activate">Activate a license</Link>
          {" · "}
          <Link to="/license">Look up a license</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
