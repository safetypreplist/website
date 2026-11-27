import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { money } from "../lib/format";
import {
  activate,
  activeOnThisDevice,
  fetchLicenseStatus,
  getDeviceId,
  getLicense,
  isLicensed,
  isRateLimitError,
  setLocalProduct,
} from "../lib/licenseClient";
import { downloadLicenseReceiptPdf } from "../lib/licenseReceipt";
import { PHOTO_LIBRARY } from "../lib/photos";
import { UPGRADE_TO_PRO_CENTS } from "../lib/pricing";
import { PRO_EXTRA_CHECKLISTS } from "../lib/copy";
import { invokeFunction } from "../lib/supabase";

type LicenseStatus = {
  product: "basic" | "pro";
  amountCents: number | null;
  purchasedAt: string;
  licenseKey: string;
  devices: Array<{ deviceId: string; activatedAt: string }>;
  thisDevice?: boolean;
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

const PANEL_CACHE_PREFIX = "spl.license.panel.v1:";
const RATE_LIMIT_MESSAGE =
  "Too many license checks from this network right now. Your checklists still work. Wait a few minutes, then try again.";

function readPanelCache(key: string): { status: LicenseStatus; payments: LicensePayment[] } | null {
  try {
    const raw = sessionStorage.getItem(PANEL_CACHE_PREFIX + key.trim().toUpperCase());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePanelCache(key: string, status: LicenseStatus, payments: LicensePayment[]) {
  try {
    sessionStorage.setItem(PANEL_CACHE_PREFIX + key.trim().toUpperCase(), JSON.stringify({ status, payments }));
  } catch {
    /* cache is a convenience only */
  }
}

/**
 * Upgrades used to add a synthetic "legacy:<id>:initial" Basic line even when the real
 * Basic checkout row already existed. Hide that placeholder whenever a real first purchase is on record.
 */
function visiblePayments(payments: LicensePayment[]) {
  const isFirstPurchase = (row: LicensePayment) =>
    row.checkoutProduct === "basic" || row.checkoutProduct === "pro" || row.checkoutProduct === "basic_additional";
  const hasRealFirst = payments.some((row) => isFirstPurchase(row) && !row.stripeSessionId.startsWith("legacy:"));
  if (!hasRealFirst) return payments;
  return payments.filter((row) => !(isFirstPurchase(row) && row.stripeSessionId.startsWith("legacy:")));
}

function LicensePanel({ embedded }: { embedded?: boolean }) {
  const local = getLicense();
  const licensedHere = isLicensed();
  const deviceId = getDeviceId();
  const ownKey = embedded && licensedHere && local?.key ? local.key : "";
  const [key, setKey] = useState(local?.key || "");
  const [editingKey, setEditingKey] = useState(!ownKey);
  const [busy, setBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<LicenseStatus | null>(() => (local?.key ? readPanelCache(local.key)?.status ?? null : null));
  const [payments, setPayments] = useState<LicensePayment[]>(() =>
    local?.key ? readPanelCache(local.key)?.payments ?? [] : [],
  );

  useEffect(() => {
    const trimmed = key.trim();
    if (trimmed.length < 8) {
      setStatus(null);
      setPayments([]);
      setError(null);
      setRetryable(false);
      return;
    }
    let live = true;
    const cached = readPanelCache(trimmed);
    if (cached) {
      setStatus(cached.status);
      setPayments(cached.payments);
    }
    const syncLocalProduct = (statusData: LicenseStatus) => {
      if (licensedHere && local?.key && statusData.product && statusData.licenseKey === local.key) {
        setLocalProduct(statusData.product);
      }
    };
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      setRetryable(false);
      const fresh = reloadTick > 0;
      void fetchLicenseStatus(trimmed, { fresh })
        .then(async (statusData) => {
          if (!live) return;
          setStatus(statusData as LicenseStatus);
          syncLocalProduct(statusData as LicenseStatus);
          try {
            const paymentsData = await invokeFunction<{ payments?: LicensePayment[] }>("license-payments", { key: trimmed });
            if (!live) return;
            const rows = paymentsData.payments || [];
            setPayments(rows);
            writePanelCache(trimmed, statusData as LicenseStatus, rows);
          } catch (err) {
            if (!live) return;
            // Keep license details visible even if purchase history fails to load.
            const limited = isRateLimitError(err);
            setRetryable(true);
            setError(
              limited
                ? RATE_LIMIT_MESSAGE
                : `${err instanceof Error ? err.message : "Something went wrong."} Purchase history could not be loaded.`,
            );
          }
        })
        .catch((err) => {
          if (!live) return;
          const limited = isRateLimitError(err);
          if (!cached && !limited) {
            setStatus(null);
            setPayments([]);
          }
          setRetryable(limited || !(err instanceof Error && err.message.toLowerCase().includes("not valid")));
          setError(limited ? RATE_LIMIT_MESSAGE : err instanceof Error ? err.message : "Could not load that license.");
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }, reloadTick > 0 ? 0 : 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [key, reloadTick]);

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const thisDeviceActive =
    Boolean(licensedHere && local?.key && status?.licenseKey === local.key) &&
    Boolean(status && activeOnThisDevice(status));

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

  return (
    <div className={embedded ? "license-app" : "license-manage"}>
      <header className={embedded ? "license-app-hero" : "license-manage-hero"}>
        <p className="eyebrow">License</p>
        <h1 className={embedded ? "page-title" : undefined}>Your Lifetime License</h1>
        <p className={embedded ? "muted license-app-lead" : "license-manage-lead"}>
          One license covers one device. Purchase history and in-app offers appear below once your key is recognized.
        </p>
      </header>

      <section className={embedded ? "license-app-card account-card" : "license-manage-card"}>
        {editingKey ? (
          <label className="field">
            <span>{ownKey ? "Look up another license key" : "License key"}</span>
            <input
              className="license-key-input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="SPL-XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
        {ownKey ? (
          <button
            className="license-key-toggle"
            type="button"
            onClick={() => {
              if (editingKey) setKey(ownKey);
              setEditingKey((value) => !value);
            }}
          >
            {editingKey ? "Back to this device's license" : "Look up a different license key"}
          </button>
        ) : null}
        {busy && !status ? <p className="muted license-manage-status">Loading license details…</p> : null}
        {error ? (
          <div className="license-error-row" role="alert">
            <p className="form-error">{error}</p>
            {retryable ? (
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setReloadTick((n) => n + 1)}>
                {busy ? "Checking…" : "Try again"}
              </button>
            ) : null}
          </div>
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
                <dd className="license-key-readonly">
                  <code>{status.licenseKey}</code>
                  <button className="btn btn-ghost" type="button" onClick={() => void copyKey(status.licenseKey)}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Device</dt>
                <dd>
                  {status.devices.length === 0
                    ? "No device activated yet"
                    : status.devices.map((device) => (
                        <span key={device.deviceId} className="license-manage-device">
                          {device.deviceId.startsWith("other-device-") ? "Another device" : `${device.deviceId.slice(0, 8)}…`} ·{" "}
                          {formatDate(device.activatedAt)}
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
              {visiblePayments(payments).map((payment) => (
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
        </div>
      ) : null}

      <aside className={embedded ? "license-app-aside account-card" : "license-manage-aside"}>
        <p className="eyebrow">New phone or computer?</p>
        <p>Move your license and your checklist to it in about a minute.</p>
        <Link className={embedded ? "btn btn-forest" : "btn btn-ghost"} to={embedded ? "/app/transfer" : "/activate"}>
          Move to a new device
        </Link>
      </aside>

      {!embedded ? (
        <aside className="license-manage-aside license-recovery-aside">
          <p className="eyebrow">Forgot your license key?</p>
          <p>We can email a secure link to the address on your original purchase so you can see your key.</p>
          <Link className="btn btn-primary" to="/license-recovery">
            Find my key
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
