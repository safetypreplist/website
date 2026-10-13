import { FormEvent, useState } from "react";
import { AccessChoice, type AccessLevel } from "./AccessChoice";
import { invokeFunction, supabase } from "../lib/supabase";
import type { FamilyInviteResult } from "../types";

export type FamilyRow = { first: string; last: string; email: string; permission: AccessLevel };
export type FamilyRowResult = { ok: boolean; text: string; url?: string };

export function emptyFamilyRows(count: number): FamilyRow[] {
  return Array.from({ length: Math.max(0, count) }, () => ({ first: "", last: "", email: "", permission: "view" as AccessLevel }));
}

export async function loadOpenFamilySeats(userId: string) {
  const { data } = await supabase
    .from("personal_checklists")
    .select("id")
    .eq("purchased_by_user_id", userId)
    .eq("status", "pending_claim")
    .is("owner_user_id", null)
    .is("invited_email", null)
    .order("created_at");
  return ((data || []) as Array<{ id: string }>).map((row) => row.id);
}

export function familyRowsError(rows: FamilyRow[], ownEmail?: string) {
  const emails = rows.map((row) => row.email.trim().toLowerCase()).filter(Boolean);
  if (new Set(emails).size !== emails.length) return "Each family member needs a different email address.";
  if (ownEmail && emails.includes(ownEmail.trim().toLowerCase())) {
    return "Use each family member's own email, not yours.";
  }
  return "";
}

export async function sendFamilyInvites(
  seatIds: string[],
  rows: FamilyRow[],
  previous: Record<number, FamilyRowResult> = {},
  onProgress?: (results: Record<number, FamilyRowResult>) => void,
) {
  const results: Record<number, FamilyRowResult> = { ...previous };
  for (const [index, row] of rows.entries()) {
    if (results[index]?.ok || results[index]?.url || !row.email.trim()) continue;
    const seatId = seatIds[index];
    if (!seatId) {
      results[index] = { ok: false, text: "There's no open seat left for this person. Add another checklist from Manage Family Plan." };
      continue;
    }
    try {
      const result = await invokeFunction<FamilyInviteResult>("family-invite", {
        action: "send",
        checklistId: seatId,
        firstName: row.first.trim(),
        lastName: row.last.trim(),
        email: row.email.trim(),
        permission: row.permission,
      });
      results[index] = result.emailSent
        ? { ok: true, text: `Invite sent to ${result.firstName} at ${result.email}.` }
        : {
            ok: false,
            text: `${result.emailError || "We couldn't email them."} Send ${result.firstName} this link instead:`,
            url: result.inviteUrl,
          };
    } catch (err) {
      results[index] = { ok: false, text: err instanceof Error ? err.message : "Could not send this invitation." };
    }
    onProgress?.({ ...results });
  }
  return results;
}

export function FamilyMemberRows({
  rows,
  onChange,
  results = {},
  disabled = false,
}: {
  rows: FamilyRow[];
  onChange: (rows: FamilyRow[]) => void;
  results?: Record<number, FamilyRowResult>;
  disabled?: boolean;
}) {
  function update(index: number, patch: Partial<FamilyRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <>
      {rows.map((row, index) => {
        const result = results[index];
        const locked = Boolean(result?.ok || result?.url);
        return (
          <fieldset className="family-setup-row" key={index} disabled={locked || disabled}>
            <legend>Family member {index + 2}</legend>
            <div className="family-setup-fields">
              <label className="field">
                <span>First name</span>
                <input
                  required={Boolean(row.email.trim())}
                  value={row.first}
                  onChange={(e) => update(index, { first: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={row.last} onChange={(e) => update(index, { last: e.target.value })} autoComplete="off" />
              </label>
              <label className="field family-setup-email">
                <span>Email</span>
                <input
                  type="email"
                  required={Boolean(row.first.trim())}
                  value={row.email}
                  onChange={(e) => update(index, { email: e.target.value })}
                  autoComplete="off"
                />
              </label>
            </div>
            <AccessChoice
              name={row.first}
              value={row.permission}
              onChange={(permission) => update(index, { permission })}
            />
            {result ? <FamilyRowMessage result={result} /> : null}
          </fieldset>
        );
      })}
    </>
  );
}

export function FamilyRowMessage({ result }: { result: FamilyRowResult }) {
  return (
    <div className={`seat-message ${result.ok ? "is-ok" : "is-error"}`} role="status">
      <p>{result.text}</p>
      {result.url ? (
        <input
          className="family-setup-link"
          readOnly
          value={result.url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Invite link"
        />
      ) : null}
    </div>
  );
}

export function FamilySeatSetup({
  seatIds,
  onDone,
  doneLabel = "Go to My Checklist",
}: {
  seatIds: string[];
  onDone: () => void;
  doneLabel?: string;
}) {
  const [rows, setRows] = useState<FamilyRow[]>(() => emptyFamilyRows(seatIds.length));
  const [results, setResults] = useState<Record<number, FamilyRowResult>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sentCount = Object.values(results).filter((r) => r.ok || r.url).length;
  const allHandled = seatIds.every((_, index) => results[index]?.ok || results[index]?.url);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = familyRowsError(rows);
    setError(problem);
    if (problem) return;
    setBusy(true);
    setResults(await sendFamilyInvites(seatIds, rows, results, setResults));
    setBusy(false);
  }

  return (
    <div className="family-setup">
      <p className="family-setup-lead">
        Your plan includes {seatIds.length === 1 ? "1 more checklist" : `${seatIds.length} more checklists`}. Enter
        each family member's name and email. We'll send them a link to create their own account.
      </p>
      <form onSubmit={(e) => void onSubmit(e)}>
        <FamilyMemberRows rows={rows} onChange={setRows} results={results} disabled={busy} />
        {error ? <p className="form-error">{error}</p> : null}
        {!allHandled ? (
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={busy || rows.every((row) => !row.email.trim())}
          >
            {busy ? "Sending invites..." : seatIds.length === 1 ? "Send invite" : "Send invites"}
          </button>
        ) : null}
      </form>
      {allHandled ? (
        <button className="btn btn-primary btn-block" type="button" onClick={onDone}>
          {doneLabel}
        </button>
      ) : (
        <button className="family-setup-later" type="button" onClick={onDone} disabled={busy}>
          {sentCount > 0 ? "Finish the rest later" : "I'll do this later"}
        </button>
      )}
      {!allHandled ? (
        <p className="muted family-setup-note">
          You can add or change family members anytime from Manage Family Plan.
        </p>
      ) : null}
    </div>
  );
}
