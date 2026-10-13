import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useApp } from "../context/AppContext";
import { formatDateTime } from "../lib/format";

export function DevicesPage() {
  const { devices, currentDevice, profile, renameDevice, removeDevice, deviceLimitReached } = useApp();
  const used = devices.length;
  const limit = profile?.device_limit ?? 2;
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const renaming = devices.find((device) => device.id === renameId);
  const removing = devices.find((device) => device.id === removeId);
  const removingCurrent = Boolean(removing && removing.id === currentDevice?.id);

  async function saveRename() {
    if (!renameId) return;
    const next = renameValue.trim();
    if (!next) return;
    setBusy(true);
    try {
      await renameDevice(renameId, next);
      setRenameId(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removeId) return;
    setBusy(true);
    setRemoveError("");
    try {
      await removeDevice(removeId);
      setRemoveId(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Could not remove that device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">My Devices</h1>

      {deviceLimitReached ? (
        <div className="status-banner">
          <h2>Device limit reached</h2>
          <p>
            This login is already in use on {limit} devices, so this device is not registered yet. Remove a device you no
            longer use and this one is added automatically. Your other devices stay signed in.
          </p>
        </div>
      ) : null}

      {devices.length === 0 ? (
        <div className="empty-panel">
          <p>No devices yet.</p>
        </div>
      ) : (
        devices.map((device) => (
          <article className="device-card" key={device.id}>
            <h3 className="card-name">{device.nickname}</h3>
            <p>{device.device_description || "Browser"}</p>
            {currentDevice?.id === device.id ? <p className="badge-current">Current device</p> : null}
            <p className="muted">Last active {formatDateTime(device.last_seen_at)}</p>
            <div className="toolbar">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setRenameId(device.id);
                  setRenameValue(device.nickname || "");
                }}
              >
                Rename
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  setRemoveError("");
                  setRemoveId(device.id);
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ))
      )}

      <p className="muted">
        {used} of {limit} active
      </p>

      <div className="device-help">
        <h2>How devices work</h2>
        <p>
          Each login can be used on up to {limit} devices, such as a phone and a computer. Family members with their own
          login get their own {limit} devices. People who share one login share its {limit} devices.
        </p>
        <p>
          On a computer or Android device, the website and the installed app count as one device. On iPhone and iPad,
          Safari and the Home Screen app keep separate storage, so they count as two. Choose one and use it every time.
        </p>
        <p>
          Replacing a device? Remove the old one here, then sign in on the new one. Your other devices stay signed in.
        </p>
      </div>

      {renaming ? (
        <ConfirmDialog
          title="Rename device"
          confirmLabel="Save name"
          busy={busy}
          onClose={() => setRenameId(null)}
          onConfirm={saveRename}
        >
          <label className="field">
            <span>Device nickname</span>
            <input
              required
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
            />
          </label>
        </ConfirmDialog>
      ) : null}

      {removing ? (
        <ConfirmDialog
          title={removingCurrent ? "Remove this device?" : `Remove ${removing.nickname || "this device"}?`}
          body={
            removingCurrent
              ? "This signs you out on this device. Your other devices stay signed in."
              : "This signs that device out of Safety Prep List and frees its place for a new device. Your other devices stay signed in. Changes on it that have not synced stay saved on it and sync if you sign in there again while a place is free."
          }
          confirmLabel="Remove device"
          danger
          busy={busy}
          onClose={() => setRemoveId(null)}
          onConfirm={confirmRemove}
        >
          {removeError ? <p className="form-error">{removeError}</p> : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
