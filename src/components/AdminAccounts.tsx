import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { planLabel } from "../lib/plan";

type Account = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "customer" | "owner";
  plan: string;
  access_status: string;
  created_at: string;
};

type AccountListResponse = { accounts?: Account[]; error?: string };
type PasswordResponse = { ok?: boolean; error?: string };

export function AdminAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<AccountListResponse>(
        "admin-account-control",
        { body: { action: "list_accounts" } },
      );
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((account) =>
      `${account.email || ""} ${account.full_name || ""} ${account.role} ${account.plan}`.toLowerCase().includes(needle),
    );
  }, [accounts, query]);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setNotice("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<PasswordResponse>(
        "admin-account-control",
        { body: { action: "set_password", account_id: selected.id, new_password: newPassword } },
      );
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNewPassword("");
      setConfirmPassword("");
      setNotice(`Password updated for ${selected.email || "the selected account"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that password.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="admin-section-heading">
      <div>
        <p className="eyebrow">Owner controls</p>
        <h2>Accounts & access</h2>
        <p className="muted">Live customer accounts from Supabase. Passwords are reset securely and never displayed.</p>
      </div>
      <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void loadAccounts()}>
        {loading ? "Refreshing…" : "Refresh accounts"}
      </button>
    </div>

    <section className="admin-panel admin-table-panel">
      <div className="admin-table-toolbar">
        <label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or plan" /></label>
        <span className="table-muted">{accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
      </div>
      {loading ? <p className="muted" style={{ padding: 20 }}>Loading accounts…</p> : filtered.length ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Account</th><th>Role</th><th>Plan</th><th>Access</th><th>Joined</th><th /></tr></thead>
          <tbody>{filtered.map((account) => <tr key={account.id}>
            <td><div className="customer-cell"><span className="customer-avatar">{(account.full_name || account.email || "SP").slice(0, 2).toUpperCase()}</span><span><b>{account.full_name || account.email || "Unnamed account"}</b><small>{account.email || "No email"}</small></span></div></td>
            <td><span className={`status-pill ${account.role === "owner" ? "active" : "review"}`}>{account.role === "owner" ? "Owner" : "Customer"}</span></td>
            <td>{planLabel(account.plan)}</td>
            <td>{account.access_status || "—"}</td>
            <td>{account.created_at ? new Date(account.created_at).toLocaleDateString() : "—"}</td>
            <td><button className="table-action-button" type="button" onClick={() => { setSelected(account); setError(""); setNotice(""); }}>Manage password</button></td>
          </tr>)}</tbody>
        </table></div>
      ) : <p className="muted" style={{ padding: 20 }}>{error ? "Account list unavailable." : "No matching accounts."}</p>}
    </section>

    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {notice ? <p className="account-saved" role="status">{notice}</p> : null}

    {selected ? <div className="admin-drawer-backdrop" onClick={() => setSelected(null)}>
      <aside className="admin-drawer" onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" type="button" onClick={() => setSelected(null)}>×</button>
        <p className="eyebrow">Owner account control</p>
        <h2>Change password</h2>
        <p className="muted">Set a new password for <b>{selected.email || "this account"}</b>. The existing password is not shown.</p>
        <form onSubmit={(event) => void resetPassword(event)}>
          <label className="account-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <label className="account-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {notice ? <p className="account-saved" role="status">{notice}</p> : null}
          <div className="drawer-actions"><button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>Close</button><button className="btn btn-forest" type="submit" disabled={saving}>{saving ? "Updating…" : "Update password"}</button></div>
        </form>
      </aside>
    </div> : null}
  </>;
}
