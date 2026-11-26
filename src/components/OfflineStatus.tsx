import { useEffect, useRef, useState } from "react";
import { useApp, type OfflineStatus } from "../context/AppContext";

export function syncLabel(offline: OfflineStatus, online: boolean) {
  if (offline.pending > 0) return "Changes waiting to save";
  if (!online || offline.usingSavedCopy) return offline.savedAt ? "Available offline" : "Offline";
  return "Saved on this device";
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
              : "This device hasn’t saved your checklist yet. Reconnect to refresh it."}
        </span>
      </div>
      <button type="button" aria-label="Close" onClick={() => setNotice(null)}>×</button>
    </div>
  );
}

/** Shown at the top of every signed-in page when something about saving needs the customer's attention. */
export function AppStatusBanners() {
  const { offline, online, retrySync, discardChange, demoMode } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (demoMode) return null;

  return (
    <>
      <ConnectionNotice offline={offline} online={online} />
      {offline.issues.length ? (
        <div className="status-banner offline-banner warn" role="alert">
          <b>
            {offline.issues.length} {offline.issues.length === 1 ? "change has" : "changes have"} not saved yet.
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
            <button className="btn btn-ghost" type="button" onClick={() => setOpen((value) => !value)}>
              {open ? "Hide details" : "Details"}
            </button>
          </div>
          {open ? (
            <ul className="offline-issue-list">
              {offline.issues.map((issue) => (
                <li key={issue.key}>
                  <span>
                    <b>{issue.key}</b>
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
