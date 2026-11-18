import { FormEvent, useEffect, useState } from "react";
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

const SECRET_KEY = "spl.admin.secret";

export function AdminLicenses({ onSaved }: { onSaved?: (message: string) => void }) {
  const [secret, setSecret] = useState(() => sessionStorage.getItem(SECRET_KEY) || "");
  const [unlocked, setUnlocked] = useState(() => Boolean(sessionStorage.getItem(SECRET_KEY)));
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function load(nextSecret = secret) {
    setBusy(true);
    setError("");
    try {
      const data = await invokeFunction<{ licenses?: LicenseRow[] }>("admin-licenses", {
        action: "list",
        adminSecret: nextSecret,
      });
      setRows(data.licenses || []);
      sessionStorage.setItem(SECRET_KEY, nextSecret);
      setUnlocked(true);
    } catch (err) {
      setUnlocked(false);
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load licenses.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (unlocked && secret) void load(secret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    await load(secret.trim());
  }

  async function runPending() {
    if (!pending) return;
    setActionBusy(true);
    setError("");
    try {
      await invokeFunction("admin-licenses", {
        action: pending.action,
        licenseId: pending.license.id,
        adminSecret: secret,
      });
      onSaved?.(
        pending.action === "deactivate"
          ? "License deactivated. The key can be activated again."
          : pending.action === "revoke"
            ? "License revoked."
            : "License restored.",
      );
      setPending(null);
      await load(secret);
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
          <h2>One-time licenses</h2>
          <p className="muted">Deactivate, revoke, or restore a key. Protected by ADMIN_SECRET.</p>
        </div>
      </div>

      {!unlocked ? (
        <form onSubmit={(e) => void unlock(e)} className="stack" style={{ maxWidth: 420, gap: 12 }}>
          <label>
            Admin secret
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy || !secret.trim()}>
            {busy ? "Checking…" : "Unlock licenses"}
          </button>
        </form>
      ) : (
        <>
          <div className="toolbar" style={{ marginBottom: 16, gap: 10 }}>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void load(secret)}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                sessionStorage.removeItem(SECRET_KEY);
                setUnlocked(false);
                setRows([]);
              }}
            >
              Lock
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
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code>{row.license_key}</code>
                    </td>
                    <td>{row.product === "pro" ? "Pro" : "Basic"}</td>
                    <td>{row.status}</td>
                    <td>{row.devices_used}</td>
                    <td>{new Date(row.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="toolbar" style={{ gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={row.status !== "active"}
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
                ))}
                {!rows.length && !busy ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No licenses yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

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
