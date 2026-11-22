import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { invokeFunction } from "../lib/supabase";

type LicenseRow = {
  id: string;
  license_key: string;
  product: "basic" | "pro";
  status: "active" | "revoked";
  email: string | null;
  devices_used: number;
  created_at: string;
};

type GroupRow = {
  id: string;
  name: string | null;
  status: "pending_setup" | "active" | "ended" | "expired";
  max_devices: number;
  duration_days: number;
  expires_at: string | null;
  created_at: string;
  host_license_key: string | null;
  host_email: string | null;
  member_count: number;
};

function licenseControlLabel(row: LicenseRow) {
  if (row.status === "revoked") return "Revoked";
  if ((row.devices_used || 0) <= 0) return "Deactivated";
  return "Activated";
}

type PendingAction = {
  license: LicenseRow;
  action: "deactivate" | "revoke" | "restore";
};

const CONFIRM: Record<PendingAction["action"], { title: string; body: string; label: string; danger?: boolean }> = {
  deactivate: {
    title: "Deactivate this license?",
    body: "The customer will need to activate this license again on their device.",
    label: "Deactivate",
    danger: true,
  },
  revoke: {
    title: "Revoke this license?",
    body: "Revoked keys cannot activate until restored.",
    label: "Revoke",
    danger: true,
  },
  restore: {
    title: "Restore this license?",
    body: "This sets the license back to active so it can be activated on a device.",
    label: "Restore",
  },
};

export function AdminLicenses({ onSaved }: { onSaved?: (message: string) => void }) {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await invokeFunction<{ licenses?: LicenseRow[]; groups?: GroupRow[] }>("admin-licenses", {
        action: "list",
      });
      setRows(data.licenses || []);
      setGroups(data.groups || []);
    } catch (err) {
      setRows([]);
      setGroups([]);
      setError(err instanceof Error ? err.message : "Could not load licenses.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runPending() {
    if (!pending) return;
    setActionBusy(true);
    setError("");
    try {
      await invokeFunction("admin-licenses", {
        action: pending.action,
        licenseId: pending.license.id,
      });
      onSaved?.(
        pending.action === "deactivate"
          ? "License deactivated. The key can be activated again."
          : pending.action === "revoke"
            ? "License revoked."
            : "License restored.",
      );
      setPending(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that license.");
      setPending(null);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Licenses</p>
          <h2>License control</h2>
          <p className="muted">
            Deactivate frees the device binding (key stays valid). Revoke blocks activation until restored.
          </p>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 16, gap: 10 }}>
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void load()}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Product</th>
              <th>Status</th>
              <th>Devices</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const control = licenseControlLabel(row);
              const canDeactivate = row.status === "active" && (row.devices_used || 0) > 0;
              return (
                <tr key={row.id}>
                  <td>
                    <code>{row.license_key}</code>
                    {row.email ? <div className="muted">{row.email}</div> : null}
                  </td>
                  <td>{row.product === "pro" ? "Pro" : "Basic"}</td>
                  <td>
                    <span className={`admin-status-pill is-${control.toLowerCase()}`}>{control}</span>
                  </td>
                  <td>{row.devices_used}</td>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="toolbar" style={{ gap: 6, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={!canDeactivate}
                        onClick={() => setPending({ license: row, action: "deactivate" })}
                      >
                        Deactivate
                      </button>
                      {row.status === "revoked" ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => setPending({ license: row, action: "restore" })}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => setPending({ license: row, action: "revoke" })}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!busy && rows.length === 0 && !error ? (
              <tr>
                <td colSpan={6} className="muted">
                  No licenses yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-section-heading" style={{ marginTop: 28 }}>
        <div>
          <p className="eyebrow">Group Sharing</p>
          <h2>Sessions</h2>
          <p className="muted">Recent Group Sharing sessions tied to host licenses.</p>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Host</th>
              <th>Status</th>
              <th>Size</th>
              <th>Expires</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id}>
                <td>
                  <strong>{group.name || "Pending setup"}</strong>
                  <div className="muted">{group.member_count} members</div>
                </td>
                <td>
                  <code>{group.host_license_key || "—"}</code>
                  {group.host_email ? <div className="muted">{group.host_email}</div> : null}
                </td>
                <td>{group.status}</td>
                <td>
                  {group.max_devices} · {group.duration_days}d
                </td>
                <td>{group.expires_at ? new Date(group.expires_at).toLocaleString() : "—"}</td>
                <td>{new Date(group.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!busy && groups.length === 0 && !error ? (
              <tr>
                <td colSpan={6} className="muted">
                  No Group Sharing sessions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pending ? (
        <ConfirmDialog
          title={CONFIRM[pending.action].title}
          body={CONFIRM[pending.action].body}
          confirmLabel={CONFIRM[pending.action].label}
          danger={CONFIRM[pending.action].danger}
          busy={actionBusy}
          onClose={() => {
            if (!actionBusy) setPending(null);
          }}
          onConfirm={() => void runPending()}
        />
      ) : null}
    </div>
  );
}
