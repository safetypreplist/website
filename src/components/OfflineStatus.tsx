import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, type OfflineStatus } from "../context/AppContext";
import { readOnlyUntil } from "../lib/accessPolicy";
import { formatDate } from "../lib/format";

export function syncLabel(offline: OfflineStatus, online: boolean) {
  if (offline.pending > 0) return "Changes waiting to sync";
  if (!online || offline.usingSavedCopy) return offline.savedAt ? "Available offline" : "Offline";
  return "Synced";
}

const NOTICE_MS = { offline: 7000, online: 4000 };

/** A short pop-up when this device goes offline or comes back online. */
function ConnectionNotice({ offline, online }: { offline: OfflineStatus; online: boolean }) {
  const isOffline = !online || offline.usingSavedCopy;
  const [notice, setNotice] = useState<"offline" | "online" | null>(isOffline ? "offline" : null);
  const previous = useRef(isOffline);

  useEffect(() => {
    if (previous.current === isOffline) return;
    previous.current = isOffline;
    setNotice(isOffline ? "offline" : "online");
  }, [isOffline]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS[notice]);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  const goingOffline = notice === "offline";
  return (
    <div className={`connection-notice ${goingOffline ? "is-offline" : "is-online"}`} role="status" aria-live="polite">
      <span className="connection-dot" aria-hidden="true" />
      <div>
        <b>{goingOffline ? "Offline mode" : "Back online"}</b>
        <span>
          {!goingOffline
            ? "Your changes sync automatically."
            : offline.savedAt
              ? "No internet right now. Your checklist still works, and changes save on this device."
              : "This device hasn’t saved your checklist yet. Reconnect, then turn on Offline access on Home."}
        </span>
      </div>
      <button type="button" aria-label="Close" onClick={() => setNotice(null)}>×</button>
    </div>
  );
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
      <ConnectionNotice offline={offline} online={online} />
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

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const MIN_SPIN_MS = 1800;

/** One switch: on saves every checklist this login can open onto this device. */
export function OfflineSwitch({ card = false }: { card?: boolean }) {
  const { offline, online, prepareOffline, turnOffOffline, demoMode } = useApp();
  const [busy, setBusy] = useState(false);
  const [justOn, setJustOn] = useState(false);
  const [error, setError] = useState("");
  const on = Boolean(offline.preparedAt);
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current || !offline.preparedAt || !online || demoMode) return;
    if (Date.now() - Date.parse(offline.preparedAt) < REFRESH_AFTER_MS) return;
    refreshed.current = true;
    void prepareOffline().catch(() => undefined);
  }, [offline.preparedAt, online, demoMode, prepareOffline]);

  async function toggle() {
    setError("");
    if (on) {
      setJustOn(false);
      await turnOffOffline();
      return;
    }
    setBusy(true);
    try {
      await Promise.all([prepareOffline(), new Promise((resolve) => window.setTimeout(resolve, MIN_SPIN_MS))]);
      setJustOn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn on offline access. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const message = busy
    ? "Getting your checklist ready…"
    : on
      ? justOn
        ? "You’re ready. If your Wi-Fi goes down, your checklist still works on this device."
        : "On. Your checklist works on this device even without internet."
      : !online
        ? "Connect to the internet to turn this on."
        : "Use your checklist even when Wi-Fi or cell service is down.";

  return (
    <div className={`offline-switch${card ? " is-card" : ""}${on ? " is-on" : ""}${justOn ? " just-on" : ""}`}>
      <div className="offline-switch-text">
        <b id="offline-switch-label">Offline access</b>
        <span role="status">{message}</span>
        {offline.storage?.low ? <span className="offline-switch-warn">This device is almost out of storage.</span> : null}
        {error ? <span className="form-error">{error}</span> : null}
      </div>
      <button
        type="button"
        role="switch"
        className={`switch${busy ? " is-busy" : ""}`}
        aria-checked={on || busy}
        aria-labelledby="offline-switch-label"
        aria-busy={busy}
        disabled={busy || demoMode || (!on && !online)}
        onClick={() => void toggle()}
      >
        <span className="switch-knob" aria-hidden="true" />
      </button>
    </div>
  );
}
