import { useApp } from "../context/AppContext";
import { formatDateTime } from "../lib/format";

export function DevicesPage() {
  const { devices, currentDevice, profile, renameDevice, removeDevice, deviceLimitReached } = useApp();
  const used = devices.length;
  const limit = profile?.device_limit ?? 2;

  async function rename(id: string) {
    const next = prompt("Device nickname", devices.find((d) => d.id === id)?.nickname || "");
    if (!next) return;
    await renameDevice(id, next);
  }

  async function remove(id: string) {
    if (!confirm("Remove this device? You can sign in on it again later if a slot is free.")) return;
    await removeDevice(id);
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
              <button className="btn btn-ghost" type="button" onClick={() => void rename(device.id)}>
                Rename
              </button>
              <button className="btn btn-danger" type="button" onClick={() => void remove(device.id)}>
                Remove
              </button>
            </div>
          </article>
        ))
      )}

      <p className="muted">
        {used} of {limit} active
      </p>
    </div>
  );
}
