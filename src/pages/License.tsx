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
import { downloadLicenseReceiptPdf } from "../lib/licenseReceipt";
import { PHOTO_LIBRARY } from "../lib/photos";
import { BASIC_ADDITIONAL_CENTS, BASIC_LICENSE_CENTS, UPGRADE_TO_PRO_CENTS } from "../lib/pricing";
import { PRO_EXTRA_CHECKLISTS } from "../lib/copy";
import { invokeFunction } from "../lib/supabase";

type LicenseStatus = {
  product: "basic" | "pro";
  amountCents: number | null;
  purchasedAt: string;
  licenseKey: string;
  devices: Array<{ deviceId: string; activatedAt: string }>;
};

type LicensePayment = {
  id: string;
  stripeSessionId: string;
  paymentIntentId: string | null;
  checkoutProduct: string;
  description: string;
  amountCents: number;
  taxCents: number | null;
  currency: string;
  paymentMethodSummary: string | null;
  receiptUrl: string | null;
  paidAt: string;
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
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [payments, setPayments] = useState<LicensePayment[]>([]);

  useEffect(() => {
    const trimmed = key.trim();
    if (trimmed.length < 8) {
      setStatus(null);
      setPayments([]);
      setError(null);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      void Promise.all([
        invokeFunction<LicenseStatus>("license-status", { key: trimmed }),
        invokeFunction<{ payments?: LicensePayment[] }>("license-payments", { key: trimmed }).catch(() => ({
          payments: [] as LicensePayment[],
        })),
      ])
        .then(([statusData, paymentsData]) => {
          if (!live) return;
          setStatus(statusData);
          setPayments(paymentsData.payments || []);
          if (licensedHere && local?.key && statusData.product && statusData.licenseKey === local.key) {
            setLocalProduct(statusData.product);
          }
          setBusy(false);
        })
        .catch((err) => {
          if (!live) return;
          setStatus(null);
          setPayments([]);
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

  async function downloadReceipt(payment: LicensePayment) {
    if (!status) return;
    setReceiptBusy(payment.id);
    setError(null);
    try {
      await downloadLicenseReceiptPdf({
        ...payment,
        licenseKey: status.licenseKey,
        product: status.product,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download that receipt.");
    } finally {
      setReceiptBusy(null);
    }
  }

  const showOffers = Boolean(status && thisDeviceActive);
  const showUpgrade = Boolean(showOffers && status?.product === "basic");
  const showAddDevice = Boolean(showOffers);
  const discountCents = BASIC_LICENSE_CENTS - BASIC_ADDITIONAL_CENTS;

  return (
    <div className={embedded ? "license-app" : "license-manage"}>
      <header className={embedded ? "license-app-hero" : "license-manage-hero"}>
        <p className="eyebrow">My license</p>
        <h1 className={embedded ? "page-title" : undefined}>Your Lifetime License</h1>
        <p className={embedded ? "muted license-app-lead" : "license-manage-lead"}>
          One license covers one device. Purchase history and in-app offers appear below once your key is recognized.
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
              <span>Current plan</span>
              <strong>{status.product === "pro" ? "PRO" : "BASIC"}</strong>
            </div>
            <dl className="license-manage-facts">
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
                <Link className="btn btn-ghost" to="/app">
                  Open My Checklist
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {status ? (
        <section className={embedded ? "license-app-card account-card" : "license-manage-card"}>
          <h2 className="license-section-title">Purchase History</h2>
          <p className="muted license-section-lead">
            Verified transactions for this license. Original purchases stay on record when you upgrade.
          </p>
          {payments.length === 0 ? (
            <p className="muted">No purchase records are available yet for this license.</p>
          ) : (
            <ul className="license-history-list">
              {payments.map((payment) => (
                <li key={payment.id}>
                  <div>
                    <p className="license-history-date">{formatDate(payment.paidAt)}</p>
                    <p className="license-history-desc">
                      {payment.description} — {money(payment.amountCents)}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={receiptBusy === payment.id}
                    onClick={() => void downloadReceipt(payment)}
                  >
                    {receiptBusy === payment.id ? "Preparing…" : "Download Receipt PDF"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showOffers ? (
        <div className="license-offer-grid">
          {showUpgrade ? (
            <article className={embedded ? "license-app-card account-card license-offer-card" : "license-manage-card license-offer-card"}>
              <p className="eyebrow">Upgrade</p>
              <h2>Upgrade to Pro</h2>
              <p>
                Keep everything in Basic, plus five additional preparedness checklists for off-grid, water, power,
                cooling, and long-term food.
              </p>
              <ul className="license-offer-list">
                {PRO_EXTRA_CHECKLISTS.map((item) => (
                  <li key={item.title}>{item.title}</li>
                ))}
              </ul>
              <p className="license-offer-price">
                {money(UPGRADE_TO_PRO_CENTS)} <span>one-time upgrade</span>
              </p>
              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={upgradeBusy}
                onClick={() => void upgrade()}
              >
                {upgradeBusy ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            </article>
          ) : null}

          {showAddDevice ? (
            <article
              className={embedded ? "license-app-card account-card license-offer-card" : "license-manage-card license-offer-card"}
              data-onboarding="second-device-offer"
            >
              <p className="eyebrow">In-app offer</p>
              <h2>Add Another Device</h2>
              <p>
                Use Safety Prep List on an additional computer, phone, or tablet with its own lifetime Basic license.
              </p>
              <p className="license-offer-price">
                {money(BASIC_ADDITIONAL_CENTS)} <span>one-time in-app offer</span>
              </p>
              <p className="muted">
                Special in-app price — {money(discountCents)} off the regular {money(BASIC_LICENSE_CENTS)} Basic license.
              </p>
              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={addBusy}
                onClick={() => void addSecondDevice()}
              >
                {addBusy ? "Redirecting…" : "Add a Device"}
              </button>
            </article>
          ) : null}
        </div>
      ) : null}

      <aside className={embedded ? "license-app-aside account-card" : "license-manage-aside"}>
        <p className="eyebrow">Moving devices?</p>
        <p>Back up your checklists, then deactivate this license and activate on your new device.</p>
        <Link className={embedded ? "btn btn-forest" : "btn btn-ghost"} to={embedded ? "/app/transfer" : "/deactivate"}>
          Transfer / Deactivate
        </Link>
      </aside>

      {!embedded ? (
        <aside className="license-manage-aside license-recovery-aside">
          <p className="eyebrow">Forgot your license key?</p>
          <p>
            Need help recovering your license? You can securely retrieve your license using the email associated with
            your original purchase.
          </p>
          <Link className="btn btn-primary" to="/license-recovery">
            Recover My License
          </Link>
        </aside>
      ) : null}
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
