import { Fragment, useEffect, useMemo, useState } from "react";
import { invokeFunction } from "../lib/supabase";

type SupportRequest = { id: string; message: string; createdAt: string };
type SupportExport = {
  id: string;
  backupId: string | null;
  exportedAt: string;
  assistanceRecordedAt: string | null;
  assistanceNote: string | null;
  deletedAt: string | null;
};

type TransferRow = {
  tokenId: string;
  licenseId: string;
  licenseKey: string;
  product: "basic" | "pro";
  email: string | null;
  purchaseRef: string | null;
  purchasedAt: string;
  transferRequestedAt: string;
  transferConfirmedAt: string | null;
  lastDeactivatedAt: string | null;
  backupDecision: string;
  backupMethod: string;
  backup: {
    id: string;
    createdAt: string;
    expiresAt: string;
    byteSize: number;
    available: boolean;
    status: "available" | "expired" | "deleted" | "none";
  } | null;
  licenseStatus: string;
  devicesActive: number;
  activationStatus: string;
  terms: { version: string | null; acceptedAt: string | null };
  supportRequests: SupportRequest[];
  supportExports: SupportExport[];
};

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function labelDecision(value: string) {
  if (value === "backed_up") return "Backed up";
  if (value === "skipped") return "Skipped";
  return "Unknown";
}

function labelMethod(value: string) {
  if (value === "cloud") return "Cloud";
  if (value === "file") return "Downloadable file";
  if (value === "none") return "None";
  return "Unknown";
}

function labelActivation(value: string) {
  if (value === "activated") return "Activated on a device";
  if (value === "awaiting_activation") return "Awaiting activation";
  if (value === "pending_deactivation") return "Deactivation pending confirm";
  if (value === "revoked") return "Revoked";
  return value;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminTransfers({ onSaved }: { onSaved?: (message: string) => void }) {
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [assistNote, setAssistNote] = useState("");

  async function load(nextQuery = query) {
    setBusy(true);
    setError("");
    try {
      const data = await invokeFunction<{ rows?: TransferRow[] }>("admin-transfer-activity", {
        action: "list",
        query: nextQuery.trim() || undefined,
      });
      setRows(data.rows || []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load transfer activity.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => rows, [rows]);

  async function exportBackup(row: TransferRow) {
    if (!row.backup?.available) {
      setError("No available cloud backup for this license.");
      return;
    }
    setExportBusy(row.licenseId);
    setError("");
    try {
      const data = await invokeFunction<{
        ok?: boolean;
        exportId?: string;
        payload?: unknown;
        notice?: string;
        backupId?: string;
      }>("admin-transfer-activity", {
        action: "exportBackup",
        licenseId: row.licenseId,
        backupId: row.backup.id,
      });
      if (!data.payload) throw new Error("Export did not return a backup file.");
      downloadJson(`spl-support-backup-${row.licenseKey.slice(0, 12)}.json`, data.payload);
      onSaved?.(data.notice || "Backup exported for customer-requested support. Delete your local copy when finished.");
      await load();
      setOpenId(row.tokenId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export that backup.");
    } finally {
      setExportBusy(null);
    }
  }

  async function recordAssistance(exportId: string) {
    setError("");
    try {
      await invokeFunction("admin-transfer-activity", {
        action: "recordAssistance",
        exportId,
        note: assistNote.trim() || "Support assistance provided.",
      });
      setAssistNote("");
      onSaved?.("Support assistance recorded.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record assistance.");
    }
  }

  async function completeSupport(exportId: string) {
    setError("");
    try {
      const data = await invokeFunction<{ message?: string }>("admin-transfer-activity", {
        action: "completeSupportExport",
        exportId,
      });
      onSaved?.(data.message || "Support export marked complete.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete that support export.");
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Transfers</p>
          <h2>License Transfers &amp; Backup Activity</h2>
          <p className="muted">
            Review deactivation requests, backup decisions, and temporary cloud backups. Export checklist backups only
            for authorized, customer-requested support. Cloud backups expire after 48 hours.
          </p>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <label className="admin-search" style={{ minWidth: 240, flex: 1 }}>
          <span className="sr-only">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search key, email, or purchase ref"
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(query);
            }}
          />
        </label>
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void load(query)}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>License</th>
              <th>Purchase</th>
              <th>Transfer</th>
              <th>Backup</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6}>{busy ? "Loading…" : "No transfer activity yet."}</td>
              </tr>
            ) : (
              visible.map((row) => {
                const open = openId === row.tokenId;
                return (
                  <Fragment key={row.tokenId}>
                    <tr>
                      <td>
                        <code>{row.licenseKey}</code>
                        <small>
                          {row.product === "pro" ? "Pro" : "Basic"}
                          {row.email ? ` · ${row.email}` : ""}
                        </small>
                      </td>
                      <td>
                        <span>{row.purchaseRef ? row.purchaseRef.slice(0, 18) + "…" : "—"}</span>
                        <small>{formatWhen(row.purchasedAt)}</small>
                      </td>
                      <td>
                        <span>Requested {formatWhen(row.transferRequestedAt)}</span>
                        <small>
                          {row.transferConfirmedAt
                            ? `Confirmed ${formatWhen(row.transferConfirmedAt)}`
                            : "Awaiting email confirm"}
                        </small>
                      </td>
                      <td>
                        <span>
                          {labelDecision(row.backupDecision)}
                          {row.backupMethod && row.backupMethod !== "unknown"
                            ? ` · ${labelMethod(row.backupMethod)}`
                            : ""}
                        </span>
                        <small>
                          {row.backup
                            ? row.backup.available
                              ? `Cloud available · expires ${formatWhen(row.backup.expiresAt)}`
                              : `Cloud ${row.backup.status}`
                            : "No cloud backup on file"}
                        </small>
                      </td>
                      <td>
                        <span>{labelActivation(row.activationStatus)}</span>
                        <small>
                          License {row.licenseStatus} · {row.devicesActive} device
                          {row.devicesActive === 1 ? "" : "s"}
                        </small>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => setOpenId(open ? null : row.tokenId)}
                        >
                          {open ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="admin-transfer-detail-row">
                        <td colSpan={6}>
                          <div className="admin-transfer-detail">
                            <div>
                              <h3>Terms acceptance</h3>
                              <p>
                                {row.terms.version
                                  ? `Version ${row.terms.version} · ${formatWhen(row.terms.acceptedAt)}`
                                  : "No terms acceptance on file for this email."}
                              </p>
                            </div>

                            <div>
                              <h3>Support requests (transfer-related)</h3>
                              {row.supportRequests.length ? (
                                <ul>
                                  {row.supportRequests.map((ticket) => (
                                    <li key={ticket.id}>
                                      <small>{formatWhen(ticket.createdAt)}</small>
                                      <span>{ticket.message}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No matching help requests for this purchase email.</p>
                              )}
                            </div>

                            <div>
                              <h3>Cloud backup support</h3>
                              <p className="muted">
                                Temporary cloud backups auto-expire after 48 hours. Export only when the customer asks
                                for help. Do not browse checklist contents routinely.
                              </p>
                              <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
                                <button
                                  className="btn btn-forest"
                                  type="button"
                                  disabled={!row.backup?.available || exportBusy === row.licenseId}
                                  onClick={() => void exportBackup(row)}
                                >
                                  {exportBusy === row.licenseId
                                    ? "Exporting…"
                                    : row.backup?.available
                                      ? "Securely export cloud backup"
                                      : "No backup available"}
                                </button>
                              </div>

                              {row.supportExports.length ? (
                                <ul className="admin-transfer-exports">
                                  {row.supportExports.map((exp) => (
                                    <li key={exp.id}>
                                      <div>
                                        <strong>Exported {formatWhen(exp.exportedAt)}</strong>
                                        <small>
                                          {exp.assistanceRecordedAt
                                            ? `Assistance recorded ${formatWhen(exp.assistanceRecordedAt)}`
                                            : "Assistance not recorded yet"}
                                          {exp.deletedAt ? ` · Closed ${formatWhen(exp.deletedAt)}` : " · Open"}
                                        </small>
                                        {exp.assistanceNote ? <p>{exp.assistanceNote}</p> : null}
                                      </div>
                                      {!exp.deletedAt ? (
                                        <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
                                          <input
                                            value={assistNote}
                                            onChange={(e) => setAssistNote(e.target.value)}
                                            placeholder="Assistance note"
                                            style={{ minWidth: 180 }}
                                          />
                                          <button
                                            className="btn btn-ghost"
                                            type="button"
                                            onClick={() => void recordAssistance(exp.id)}
                                          >
                                            Record assistance
                                          </button>
                                          <button
                                            className="btn btn-ghost"
                                            type="button"
                                            onClick={() => void completeSupport(exp.id)}
                                          >
                                            Mark support complete
                                          </button>
                                        </div>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="muted">No support exports recorded yet.</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
