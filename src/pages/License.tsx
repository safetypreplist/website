import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { money } from "../lib/format";
import {
  activate,
  getDeviceId,
  getLicense,
  isLicensed,
  setLocalProduct,
} from "../lib/licenseClient";
import { PHOTO_LIBRARY } from "../lib/photos";
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

function LicensePanel({ embedded }: { embedded?: boolean }) {
  const local = getLicense();
  const licensedHere = isLicensed();
  const deviceId = getDeviceId();
  const [key, setKey] = useState(local?.key || "");
  const [busy, setBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    const trimmed = key.trim();
    if (trimmed.length < 8) {
      setStatus(null);
      setError(null);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      void invokeFunction<LicenseStatus>("license-status", { key: trimmed })
        .then((data) => {
          if (!live) return;
          setStatus(data);
          // Keep the local session in sync after Basic → Pro upgrades.
          if (licensedHere && local?.key && data.product && data.licenseKey === local.key) {
            setLocalProduct(data.product);
          }
          setBusy(false);
        })
        .catch((err) => {
          if (!live) return;
          setStatus(null);
          setError(err instanceof Error ? err.message : "Could not load that license.");
          setBusy(false);
        });
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [key]);

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
    <div className={embedded ? "license-app" : "license-manage"}>
      <header className={embedded ? "license-app-hero" : "license-manage-hero"}>
        <p className="eyebrow">My license</p>
        <h1 className={embedded ? "page-title" : undefined}>Your lifetime license</h1>
        <p className={embedded ? "muted license-app-lead" : "license-manage-lead"}>
          One license. One device. Details appear below as soon as your key is recognized.
        </p>
      </header>

      <section className={embedded ? "license-app-card account-card" : "license-manage-card"}>
        <label className="field">
          <span>License key</span>
          <input
            className="license-key-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="SPL-XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {busy && !status ? <p className="muted license-manage-status">Loading license details…</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {status ? (
          <div className="license-manage-details" data-onboarding="license-panel">
            <div className="license-manage-plan">
              <span>{status.product === "pro" ? "Pro" : "Basic"}</span>
              <strong>{status.amountCents != null ? money(status.amountCents) : "—"} one time</strong>
            </div>
            <dl className="license-manage-facts">
              <div>
                <dt>Purchase date</dt>
                <dd>{formatDate(status.purchasedAt)}</dd>
              </div>
              <div>
                <dt>License key</dt>
                <dd>
                  <code>{status.licenseKey}</code>
                </dd>
              </div>
              <div>
                <dt>Device</dt>
                <dd>
                  {status.devices.length === 0
                    ? "No device activated yet"
                    : status.devices.map((device) => (
                        <span key={device.deviceId} className="license-manage-device">
                          {device.deviceId.slice(0, 8)}… · {formatDate(device.activatedAt)}
                          {device.deviceId === deviceId ? " · this device" : ""}
                        </span>
                      ))}
                </dd>
              </div>
            </dl>

            <div className="license-manage-actions">
              {!thisDeviceActive ? (
                <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void activateHere()}>
                  Activate on this device
                </button>
              ) : (
                <Link className="btn btn-primary" to="/app">
                  Open checklists
                </Link>
              )}
              {thisDeviceActive ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={addBusy}
                  onClick={() => void addSecondDevice()}
                  data-onboarding="second-device-offer"
                >
                  {addBusy ? "Redirecting…" : `Add a second device · ${money(BASIC_ADDITIONAL_CENTS)}`}
                </button>
              ) : null}
              {status.product === "basic" && thisDeviceActive ? (
                <button className="btn btn-ghost" type="button" disabled={upgradeBusy} onClick={() => void upgrade()}>
                  {upgradeBusy ? "Redirecting…" : `Upgrade to Pro · ${money(UPGRADE_TO_PRO_CENTS)}`}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <aside className={embedded ? "license-app-aside account-card" : "license-manage-aside"}>
        <p className="eyebrow">Moving devices?</p>
        <p>Back up your checklists, then deactivate this license and activate on your new device.</p>
        <Link className={embedded ? "btn btn-forest" : "btn btn-ghost"} to="/app/transfer">
          Transfer / Deactivate
        </Link>
      </aside>
    </div>
  );
}

/** Public /license — redirects into the app when already activated. */
export function LicensePage() {
  if (isLicensed()) return <Navigate to="/app/license" replace />;

  return (
    <div className="checkout-stage license-gate">
      <div
        className="checkout-bg license-gate-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <main>
        <LicensePanel />
      </main>
      <PublicFooter />
    </div>
  );
}

/** In-app /app/license — stays inside AppShell. */
export function AppLicensePage() {
  return <LicensePanel embedded />;
}
