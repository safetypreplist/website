import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, type OfflineStatus, type PrepareResult } from "../context/AppContext";
import { readOnlyUntil } from "../lib/accessPolicy";
import { formatDate, formatDateTime } from "../lib/format";

export function syncLabel(offline: OfflineStatus, online: boolean) {
  if (offline.pending > 0) return "Changes waiting to sync";
  if (!online || offline.usingSavedCopy) return offline.savedAt ? "Available offline" : "Offline";
  return "Synced";
}

/** Shown at the top of every signed-in page when something about saving needs the customer's attention. */
export function AppStatusBanners() {
  const { offline, online, accessMode, myChecklist, retrySync, discardChange, demoMode } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (demoMode) return null;
  const endsAt = myChecklist?.accessEndsAt;

  return (
    <>
      {accessMode === "readonly" ? (
        <div className="status-banner offline-banner warn" role="status">
          <b>Your plan has ended.</b> Your checklists are read-only
          {endsAt ? ` until ${formatDate(readOnlyUntil(endsAt) as string)}` : ""}. Nothing has been deleted.{" "}
          <Link to="/app/renew">Renew to keep checking items off</Link>.
        </div>
      ) : null}
      {offline.usingSavedCopy || !online ? (
        <div className="status-banner offline-banner" role="status">
          {offline.savedAt ? (
            <>
              <b>You are offline.</b> Your checklists are available on this device (saved {formatDateTime(offline.savedAt)}).
              Changes you make are saved here and sync when you reconnect.
            </>
          ) : (
            <>
              <b>You are offline.</b> This device has not saved your checklists yet. Connect to the internet, then choose
              Prepare for offline use on the Home page.
            </>
          )}
        </div>
      ) : null}
      {offline.issues.length ? (
        <div className="status-banner offline-banner warn" role="alert">
          <b>
            {offline.issues.length} {offline.issues.length === 1 ? "change has" : "changes have"} not reached your account.
          </b>{" "}
          {offline.issues[0].message}
          <div className="offline-banner-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await retrySync().finally(() => setBusy(false));
              }}
            >
              {busy ? "Trying…" : "Try again"}
            </button>
            {offline.issues.some((issue) => issue.message.includes("registered devices")) ? (
              <Link className="btn btn-ghost" to="/app/devices">
                My Devices
              </Link>
            ) : null}
            <button className="btn btn-ghost" type="button" onClick={() => setOpen((value) => !value)}>
              {open ? "Hide details" : "Details"}
            </button>
          </div>
          {open ? (
            <ul className="offline-issue-list">
              {offline.issues.map((issue) => (
                <li key={issue.key}>
                  <span>
                    <b>{issue.itemLabel}</b>
                    <small>{issue.message}</small>
                  </span>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      if (window.confirm("Discard this change? It will be removed from this device and will not sync.")) {
                        void discardChange(issue.key);
                      }
                    }}
                  >
                    Discard
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {offline.conflicts > 0 && online ? (
        <p className="offline-conflict-note">
          {offline.conflicts === 1
            ? "One item was changed more recently on another device, so the newer change was kept."
            : `${offline.conflicts} items were changed more recently on another device, so the newer changes were kept.`}
        </p>
      ) : null}
    </>
  );
}

export function PrepareOfflineCard({ compact = false, embedded = false }: { compact?: boolean; embedded?: boolean }) {
  const { offline, online, prepareOffline, demoMode } = useApp();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PrepareResult | null>(null);
  const [error, setError] = useState("");

  async function prepare() {
    setBusy(true);
    setError("");
    try {
      setResult(await prepareOffline());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare offline use.");
    } finally {
      setBusy(false);
    }
  }

  const storage = result?.storage ?? offline.storage;
  return (
    <section
      className={`offline-card${compact ? " compact" : ""}${embedded ? " embedded" : ""}`}
      aria-labelledby={embedded ? undefined : "offline-card-title"}
    >
      <div>
        {embedded ? (
          offline.preparedAt && !result ? (
            <p className="muted">Saved on this device {formatDateTime(offline.preparedAt)}.</p>
          ) : null
        ) : (
          <>
            <p className="eyebrow">Offline access</p>
            <h3 id="offline-card-title">
              {offline.preparedAt ? "Ready for offline use on this device" : "Prepare for offline use"}
            </h3>
            <p className="muted">
              {offline.preparedAt
                ? `Last prepared ${formatDateTime(offline.preparedAt)}. Open the app while connected now and then so this device has your latest checklists.`
                : "Save your checklists on this device so you can open them and check items off without Wi-Fi or cell service."}
            </p>
          </>
        )}
        {result ? (
          <p className="offline-card-done" role="status">
            Done.{" "}
            {result.checklists === 1
              ? "Your checklist is saved on this device, so you can use it offline."
              : `${result.checklists} checklists are saved on this device, so you can use them offline.`}{" "}
            Changes you make offline sync when you reconnect.
          </p>
        ) : null}
        {storage && !storage.persisted ? (
          <p className="offline-card-note">
            This browser may clear saved data if the device runs low on space. Installing Safety Prep List to your home
            screen helps keep it.{embedded ? null : <> <Link to="/install">How to install</Link></>}
          </p>
        ) : null}
        {storage?.low ? (
          <p className="offline-card-note">This device is low on storage. Free up some space so your checklists stay saved.</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!compact && !embedded ? (
          <p className="offline-card-note">
            For extra peace of mind, print your most important checklists and keep a copy with your emergency supplies.
          </p>
        ) : null}
      </div>
      <button className="btn btn-primary" type="button" disabled={busy || !online || demoMode} onClick={() => void prepare()}>
        {busy ? "Preparing…" : offline.preparedAt ? "Update offline copy" : "Prepare for offline use"}
      </button>
      {!online ? <small className="muted">Connect to the internet to prepare or update.</small> : null}
    </section>
  );
}
