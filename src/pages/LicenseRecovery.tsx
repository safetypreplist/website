import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { PHOTO_LIBRARY } from "../lib/photos";
import { invokeFunction } from "../lib/supabase";

type Step = "request" | "sent" | "reveal" | "error";

type RecoveredLicense = {
  licenseKey: string;
  product: "basic" | "pro";
  deviceActive: boolean;
};

const GENERIC_SENT =
  "If that email is associated with a purchase, we sent a secure recovery link. Check your inbox and spam folder.";


export function LicenseRecoveryPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => (params.get("token") || "").trim(), [params]);
  const [step, setStep] = useState<Step>(token ? "reveal" : "request");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [licenses, setLicenses] = useState<RecoveredLicense[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const data = await invokeFunction<{ ok?: boolean; licenses?: RecoveredLicense[] }>(
          "confirm-license-recovery",
          { token },
        );
        if (!live) return;
        if (!data?.ok || !data.licenses?.length) {
          setStep("error");
          setError("That recovery link is not valid or has expired.");
          return;
        }
        setLicenses(data.licenses);
        setStep("reveal");
      } catch (err) {
        if (!live) return;
        setStep("error");
        setError(err instanceof Error ? err.message : "That recovery link is not valid or has expired.");
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  async function requestRecovery(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await invokeFunction<{ ok?: boolean; emailMasked?: string | null; message?: string }>(
        "request-license-recovery",
        { email: email.trim() },
      );
      setEmailMasked(data.emailMasked || null);
      setStep("sent");
    } catch (err) {
      // Same confirmation whether or not a license exists.
      setEmailMasked(null);
      setStep("sent");
      if (err instanceof Error && err.message.toLowerCase().includes("rate")) {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      setError("Could not copy that key. Select it and copy manually.");
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
          <p className="eyebrow">Forgot your key?</p>

          {step === "request" ? (
            <>
              <h1>Find your license key</h1>
              <p className="license-gate-lead">
                Enter the email from your original purchase. We&apos;ll send a secure link that shows your key.
              </p>
              <form onSubmit={(e) => void requestRecovery(e)} className="license-gate-form">
                <label className="field">
                  <span>Purchase email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>
                {error ? (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="btn btn-primary btn-block" type="submit" disabled={busy || !email.trim()}>
                  {busy ? "Sending…" : "Email me my key"}
                </button>
              </form>
            </>
          ) : null}

          {step === "sent" ? (
            <>
              <h1>Check your email</h1>
              <p className="license-gate-notice" role="status">
                {GENERIC_SENT}
                {emailMasked ? ` If we found a match, we sent it to ${emailMasked}.` : ""}
              </p>
              <p className="license-gate-lead">
                Open the secure link in that email to view your license key. The link works once and expires in 24 hours.
              </p>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="btn btn-ghost btn-block" type="button" onClick={() => setStep("request")}>
                Use a different email
              </button>
            </>
          ) : null}

          {step === "reveal" && busy ? (
            <>
              <h1>Verifying…</h1>
              <p className="license-gate-lead">Please wait while we confirm your recovery link.</p>
            </>
          ) : null}

          {step === "reveal" && !busy && licenses.length ? (
            <>
              <h1>Your license key{licenses.length > 1 ? "s" : ""}</h1>
              <p className="license-gate-lead">
                Save {licenses.length > 1 ? "these keys" : "this key"}. One license covers one device.
              </p>

              <div className="license-recovery-list">
                {licenses.map((item) => (
                  <article key={item.licenseKey} className="license-recovery-card">
                    <div className="license-gate-status">
                      <div>
                        <span>Plan</span>
                        <strong>{item.product === "pro" ? "Pro" : "Basic"}</strong>
                      </div>
                      <div>
                        <span>License key</span>
                        <code>{item.licenseKey}</code>
                      </div>
                      <div>
                        <span>Activation</span>
                        <strong>{item.deviceActive ? "In use on a device" : "Not activated yet"}</strong>
                      </div>
                    </div>
                    <div className="license-gate-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => void copyKey(item.licenseKey)}>
                        {copiedKey === item.licenseKey ? "Copied" : "Copy key"}
                      </button>
                      <Link className="btn btn-primary" to={`/activate#key=${encodeURIComponent(item.licenseKey)}`}>
                        Use it on this device
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {licenses.some((item) => item.deviceActive) ? (
                <p className="license-gate-notice" role="status">
                  In use on another device? Tap Use it on this device and Activate shows you how to move it here.
                </p>
              ) : null}
            </>
          ) : null}

          {step === "error" ? (
            <>
              <h1>Recovery link needed</h1>
              <p className="form-error" role="alert">
                {error || "That recovery link is not valid or has expired."}
              </p>
              <p className="license-gate-lead">Request a new recovery email with the purchase address on file.</p>
              <Link className="btn btn-primary btn-block" to="/license-recovery">
                Request a new link
              </Link>
            </>
          ) : null}
        </section>

        <p className="muted license-gate-foot">
          <Link to="/activate">Activate</Link>
          {" · "}
          <Link to="/license">License details</Link>
          {" · "}
          <Link to="/contact">Contact</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
