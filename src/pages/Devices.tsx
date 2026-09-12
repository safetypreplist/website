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

  const renaming = devices.find((device) => device.id === renameId);
  const removing = devices.find((device) => device.id === removeId);

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
    try {
      await removeDevice(removeId);
      setRemoveId(null);
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
          <p>This login can be active on {limit} devices. Remove one to continue.</p>
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
              <button className="btn btn-danger" type="button" onClick={() => setRemoveId(device.id)}>
                Remove
              </button>
            </div>
          </article>
        ))
      )}

      <p className="muted">
        {used} of {limit} active
      </p>

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
          title="Remove this device?"
          body="This signs that browser or device out of Safety Prep List. You'll need to sign in again on it if a device slot is free."
          confirmLabel="Remove device"
          danger
          busy={busy}
          onClose={() => setRemoveId(null)}
          onConfirm={confirmRemove}
        />
      ) : null}
    </div>
  );
}
