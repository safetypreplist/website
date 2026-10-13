import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { money } from "../lib/format";
import { planLabel } from "../lib/plan";
import { invokeFunction } from "../lib/supabase";
import { ConfirmDialog } from "./ConfirmDialog";

type RefundRequest = {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  message: string | null;
  status: "pending" | "refunded" | "denied";
  refunded_cents: number | null;
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  amountCents: number;
  paidAt: string;
  status: string;
  label: string;
};

type Account = {
  email: string | null;
  name: string | null;
  plan: string | null;
  accessStatus: string | null;
  firstPaidAt: string | null;
  refundableUntil: string | null;
  firstPrint: { at: string; list: string | null; source: string } | null;
  printCount: number;
  payments: Payment[];
};

type ListResponse = { requests: RefundRequest[]; accounts: Record<string, Account>; windowDays: number };

type PendingAction =
  | { kind: "refund"; request: RefundRequest; paymentIds: string[]; cents: number }
  | { kind: "deny"; request: RefundRequest }
  | { kind: "paypal"; request: RefundRequest };

const PRINT_SOURCES: Record<string, string> = {
  button: "the Print button",
  shortcut: "the Ctrl/⌘+P shortcut",
  browser: "the browser’s print menu",
};

function day(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function dayTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Reasons a request falls outside the refund policy; empty means it qualifies. */
function policyProblems(request: RefundRequest, account: Account | undefined) {
  if (!account) return ["No account uses this email address."];
  const problems: string[] = [];
  if (!account.firstPaidAt) problems.push("No completed purchase found.");
  else if (account.refundableUntil && Date.parse(request.created_at) > Date.parse(account.refundableUntil)) {
    problems.push(`Requested after the refund window closed on ${day(account.refundableUntil)}.`);
  }
  if (account.firstPrint) problems.push(`A checklist was printed on ${day(account.firstPrint.at)}.`);
  return problems;
}

export function AdminRefunds({ onPendingChange }: { onPendingChange: (count: number) => void }) {
  const { catalog } = useApp();
  const [data, setData] = useState<ListResponse | null>(null);
  const [view, setView] = useState<"pending" | "closed">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [action, setAction] = useState<PendingAction | null>(null);
  const [endAccess, setEndAccess] = useState(true);
  const [busy, setBusy] = useState(false);

  const listTitle = useCallback(
    (slug: string | null) => catalog.systems.find((system) => system.slug === slug)?.title || slug || "a checklist",
    [catalog.systems],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await invokeFunction<ListResponse>("admin-refunds", { action: "list" });
      setData(result);
      const defaults: Record<string, string[]> = {};
      for (const request of result.requests) {
        const account = request.user_id ? result.accounts[request.user_id] : undefined;
        if (request.status !== "pending" || !account) continue;
        const windowEnd = account.refundableUntil ? Date.parse(account.refundableUntil) : 0;
        defaults[request.id] = account.payments
          .filter((payment) => payment.status === "completed" && Date.parse(payment.paidAt) <= windowEnd)
          .map((payment) => payment.id);
      }
      setSelected(defaults);
      onPendingChange(result.requests.filter((request) => request.status === "pending").length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load refund requests.");
    } finally {
      setLoading(false);
    }
  }, [onPendingChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const requests = useMemo(
    () => (data?.requests || []).filter((request) => (view === "pending" ? request.status === "pending" : request.status !== "pending")),
    [data, view],
  );
  const pendingCount = (data?.requests || []).filter((request) => request.status === "pending").length;

  function togglePayment(requestId: string, paymentId: string) {
    setSelected((current) => {
      const ids = current[requestId] || [];
      return { ...current, [requestId]: ids.includes(paymentId) ? ids.filter((id) => id !== paymentId) : [...ids, paymentId] };
    });
  }

  async function confirmAction() {
    if (!action) return;
    setBusy(true);
    setError("");
    setNotice("");
    const note = notes[action.request.id] || "";
    try {
      if (action.kind === "refund") {
        await invokeFunction("admin-refunds", { action: "refund", request_id: action.request.id, payment_ids: action.paymentIds, note });
        setNotice(`Refunded ${money(action.cents)} to ${action.request.email} through PayPal.`);
      } else {
        await invokeFunction("admin-refunds", {
          action: "close",
          request_id: action.request.id,
          outcome: action.kind === "deny" ? "denied" : "refunded_in_paypal",
          end_access: action.kind === "paypal" && endAccess,
          note,
        });
        setNotice(action.kind === "deny" ? `Request from ${action.request.email} marked as denied.` : `Request from ${action.request.email} marked as refunded.`);
      }
      setAction(null);
      await load();
    } catch (err) {
      setAction(null);
      setError(err instanceof Error ? err.message : "That didn’t work. Try again.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Owner controls</p>
          <h2>Refund requests</h2>
          <p className="muted">
            Refunds are allowed within {data?.windowDays ?? 3} days of the first purchase, as long as no checklist has been printed.
            Refunding here sends the money back through PayPal, cancels the plan, and ends access.
          </p>
        </div>
        <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void load()}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="refund-tabs" role="tablist" aria-label="Refund request status">
        <button type="button" role="tab" aria-selected={view === "pending"} className={view === "pending" ? "active" : ""} onClick={() => setView("pending")}>
          Waiting {pendingCount ? <b>{pendingCount}</b> : null}
        </button>
        <button type="button" role="tab" aria-selected={view === "closed"} className={view === "closed" ? "active" : ""} onClick={() => setView("closed")}>
          Closed
        </button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="account-saved" role="status">{notice}</p> : null}

      {loading && !data ? (
        <p className="muted">Loading refund requests…</p>
      ) : !requests.length ? (
        <section className="admin-panel">
          <p className="muted" style={{ margin: 0 }}>
            {view === "pending" ? "No refund requests are waiting." : "No closed refund requests yet."}
          </p>
        </section>
      ) : (
        <div className="refund-list">
          {requests.map((request) => {
            const account = request.user_id ? data?.accounts[request.user_id] : undefined;
            const problems = policyProblems(request, account);
            const chosen = selected[request.id] || [];
            const chosenCents = (account?.payments || []).filter((p) => chosen.includes(p.id)).reduce((sum, p) => sum + p.amountCents, 0);
            return (
              <section className="admin-panel refund-card" key={request.id}>
                <div className="refund-card-head">
                  <div>
                    <h3>{request.name || account?.name || request.email}</h3>
                    <p className="muted">
                      {request.email} · requested {dayTime(request.created_at)}
                    </p>
                  </div>
                  {request.status === "pending" ? (
                    <span className={`status-pill ${problems.length ? "blocked" : "active"}`}>
                      {problems.length ? "Outside policy" : "Meets policy"}
                    </span>
                  ) : (
                    <span className={`status-pill ${request.status === "refunded" ? "active" : "review"}`}>
                      {request.status === "refunded" ? "Refunded" : "Denied"}
                    </span>
                  )}
                </div>

                {request.status === "pending" && problems.length ? (
                  <ul className="refund-problems">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                ) : null}

                {account ? (
                  <dl className="refund-facts">
                    <div>
                      <dt>First purchase</dt>
                      <dd>{day(account.firstPaidAt)}</dd>
                    </div>
                    <div>
                      <dt>Refund window ends</dt>
                      <dd>{day(account.refundableUntil)}</dd>
                    </div>
                    <div>
                      <dt>Printed</dt>
                      <dd>
                        {account.firstPrint
                          ? `Yes · ${dayTime(account.firstPrint.at)} · ${listTitle(account.firstPrint.list)} via ${PRINT_SOURCES[account.firstPrint.source] || account.firstPrint.source}${
                              account.printCount > 1 ? ` · ${account.printCount} times` : ""
                            }`
                          : "No"}
                      </dd>
                    </div>
                    <div>
                      <dt>Plan</dt>
                      <dd>
                        {planLabel(account.plan || "none")} · {account.accessStatus || "—"}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {request.message ? <blockquote className="refund-message">{request.message}</blockquote> : null}

                {request.status === "pending" ? (
                  <>
                    {account?.payments.length ? (
                      <fieldset className="refund-payments">
                        <legend>Payments to refund</legend>
                        {account.payments.map((payment) => {
                          const refundable = payment.status === "completed";
                          return (
                            <label key={payment.id} className={refundable ? "" : "is-done"}>
                              <input
                                type="checkbox"
                                disabled={!refundable}
                                checked={refundable && chosen.includes(payment.id)}
                                onChange={() => togglePayment(request.id, payment.id)}
                              />
                              <span>
                                {payment.label} · {day(payment.paidAt)}
                              </span>
                              <b>{refundable ? money(payment.amountCents) : `${money(payment.amountCents)} refunded`}</b>
                            </label>
                          );
                        })}
                      </fieldset>
                    ) : (
                      <p className="muted">No PayPal payments found for this email. If they paid with a different email, refund it in PayPal.</p>
                    )}
                    <label className="account-field">
                      <span>Private note (optional)</span>
                      <textarea
                        rows={2}
                        value={notes[request.id] || ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                        placeholder="Only you can see this."
                      />
                    </label>
                    <div className="refund-actions">
                      <button
                        className="btn btn-forest"
                        type="button"
                        disabled={!chosen.length}
                        onClick={() => setAction({ kind: "refund", request, paymentIds: chosen, cents: chosenCents })}
                      >
                        {chosen.length ? `Refund ${money(chosenCents)} through PayPal` : "Choose a payment to refund"}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => setAction({ kind: "deny", request })}>
                        Deny
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setEndAccess(true);
                          setAction({ kind: "paypal", request });
                        }}
                      >
                        I refunded it in PayPal
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted refund-outcome">
                    {request.status === "refunded"
                      ? `Closed ${day(request.resolved_at)}${request.refunded_cents ? ` · ${money(request.refunded_cents)} refunded through the admin` : " · refunded in PayPal"}`
                      : `Denied ${day(request.resolved_at)}`}
                    {request.admin_note ? ` · Note: ${request.admin_note}` : ""}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {action ? (
        <ConfirmDialog
          title={
            action.kind === "refund"
              ? `Refund ${money(action.cents)}?`
              : action.kind === "deny"
                ? "Deny this refund request?"
                : "Mark as refunded in PayPal?"
          }
          body={
            action.kind === "refund"
              ? `PayPal will send ${money(action.cents)} back to ${action.request.email}. Their subscription is cancelled and their access ends right away. This can’t be undone.`
              : action.kind === "deny"
                ? `The request from ${action.request.email} moves to Closed. Remember to reply to them in LiveAgent.`
                : `Use this after you refund ${action.request.email} directly in PayPal. The request moves to Closed.`
          }
          confirmLabel={action.kind === "refund" ? "Refund now" : action.kind === "deny" ? "Deny request" : "Mark refunded"}
          danger={action.kind === "refund"}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={confirmAction}
        >
          {action.kind === "paypal" ? (
            <label className="refund-end-access">
              <input type="checkbox" checked={endAccess} onChange={(event) => setEndAccess(event.target.checked)} />
              <span>Also cancel their subscription and end their access now</span>
            </label>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}
