import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { money } from "../lib/format";
import { activate, getDeviceId, getLicense, isLicensed, setLocalProduct } from "../lib/licenseClient";
import { BASIC_ADDITIONAL_CENTS, UPGRADE_TO_PRO_CENTS } from "../lib/pricing";
import { invokeFunction } from "../lib/supabase";

type LicenseStatus = {
  product: "basic" | "pro";
  amountCents: number | null;
  purchasedAt: string;
  licenseKey: string;
  devices: Array<{ deviceId: string; activatedAt: string }>;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

export function LicensePage() {
  const local = getLicense();
  const licensedHere = isLicensed();
  const deviceId = getDeviceId();
  const [key, setKey] = useState(local?.key || "");
  const [busy, setBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  async function lookup(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const data = await invokeFunction<LicenseStatus>("license-status", { key: key.trim() });
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up that license.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!local?.key) return;
    let live = true;
    void invokeFunction<LicenseStatus>("license-status", { key: local.key })
      .then((data) => {
        if (live) setStatus(data);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [local?.key]);

  const thisDeviceActive =
    Boolean(licensedHere && local?.key && status?.licenseKey === local.key) &&
    Boolean(status?.devices.some((d) => d.deviceId === deviceId));

  async function upgrade() {
    if (!status || status.product !== "basic") return;
    setUpgradeBusy(true);
    setError(null);
    try {
      const data = await invokeFunction<{ url?: string }>("create-checkout-session", {
        product: "upgrade_to_pro",
        licenseKey: status.licenseKey,
        origin: window.location.origin,
      });
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      window.location.assign(data.url);
    } catch (err) {
      setUpgradeBusy(false);
      setError(err instanceof Error ? err.message : "Could not start upgrade checkout.");
    }
  }

  async function addSecondDevice() {
    if (!thisDeviceActive || !local?.key) return;
    setAddBusy(true);
    setError(null);
    try {
      const data = await invokeFunction<{ url?: string }>("create-checkout-session", {
        product: "basic_additional",
        licenseKey: local.key,
        deviceId,
        origin: window.location.origin,
      });
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      window.location.assign(data.url);
    } catch (err) {
      setAddBusy(false);
      setError(err instanceof Error ? err.message : "Could not start additional license checkout.");
    }
  }

  async function activateHere() {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const stored = await activate(status.licenseKey);
      setLocalProduct(stored.product);
      window.location.assign("/app");
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not activate on this device.");
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="wrap auth-card" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 560 }}>
        <p className="eyebrow">License</p>
        <h1>Your license</h1>
        <p className="muted">One license, one device. Look up a key to see what you purchased and which device is active.</p>
        <form onSubmit={(e) => void lookup(e)} className="stack" style={{ gap: 14, marginTop: 22 }}>
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
          <button className="btn btn-primary" type="submit" disabled={busy || !key.trim()}>
            {busy ? "Looking up…" : "Look up"}
          </button>
        </form>

        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}

        {status ? (
          <div className="panel" style={{ marginTop: 28 }} data-onboarding="license-panel">
            <p className="eyebrow">{status.product === "pro" ? "Pro" : "Basic"}</p>
            <p>
              <strong>Paid:</strong> {status.amountCents != null ? money(status.amountCents) : "—"} one time
            </p>
            <p>
              <strong>Purchase date:</strong> {formatDate(status.purchasedAt)}
            </p>
            <p>
              <strong>Key:</strong> <code>{status.licenseKey}</code>
            </p>
            <p className="muted" style={{ marginTop: 12 }}>
              One license, one device.
            </p>
            <h3 style={{ marginTop: 18, marginBottom: 8 }}>Activated devices</h3>
            {status.devices.length === 0 ? (
              <p className="muted">No device activated yet.</p>
            ) : (
              <ul>
                {status.devices.map((device) => (
                  <li key={device.deviceId}>
                    <code>{device.deviceId.slice(0, 8)}…</code> · {formatDate(device.activatedAt)}
                    {device.deviceId === deviceId ? " · this device" : ""}
                  </li>
                ))}
              </ul>
            )}
            <div className="stack" style={{ gap: 10, marginTop: 18 }}>
              {!thisDeviceActive ? (
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void activateHere()}>
                  Activate on this device
                </button>
              ) : null}
              {thisDeviceActive ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={addBusy}
                  onClick={() => void addSecondDevice()}
                  data-onboarding="second-device-offer"
                >
                  {addBusy ? "Redirecting…" : `Add a second device license, ${money(BASIC_ADDITIONAL_CENTS)}.`}
                </button>
              ) : null}
              {status.product === "basic" && thisDeviceActive ? (
                <button className="btn btn-ghost" type="button" disabled={upgradeBusy} onClick={() => void upgrade()}>
                  {upgradeBusy ? "Redirecting…" : `Upgrade to Pro — ${money(UPGRADE_TO_PRO_CENTS)}`}
                </button>
              ) : null}
              <Link to="/app/reset-devices">Reset devices</Link>
            </div>
          </div>
        ) : null}
      </main>
      <PublicFooter />
    </div>
  );
}
