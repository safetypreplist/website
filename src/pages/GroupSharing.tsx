import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useApp } from "../context/AppContext";
import { money } from "../lib/format";
import {
  GROUP_SHARING_PRICES,
  acceptPermissionChange,
  endGroup,
  fetchGroupStatus,
  formatRemaining,
  inviteToGroup,
  leaveGroup,
  priceFor,
  pullSharedChecklist,
  resendInvite,
  revokeMember,
  setMemberPermission,
  setupGroup,
  startGroupCheckout,
  type GroupPermission,
  type GroupSession,
} from "../lib/groupSharing";
import { getLicense } from "../lib/licenseClient";

const DURATIONS = [7, 14, 30] as const;
const SIZES = [2, 3, 4] as const;

export function GroupSharingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setGroupViewing, clearGroupViewing, groupViewing } = useApp();
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<number>(2);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [setupName, setSetupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteKey, setInviteKey] = useState("");
  const [invitePermission, setInvitePermission] = useState<GroupPermission>("view");
  const [inviteName, setInviteName] = useState("");
  const [endConfirm, setEndConfirm] = useState(false);
  const selectedPrice = priceFor(devices, durationDays);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchGroupStatus();
      setGroup(data.group);
      if (data.group?.status === "pending_setup" && data.group.name) setSetupName(data.group.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Group Sharing.");
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (params.get("setup") === "1" && group?.status === "pending_setup") {
      document.getElementById("group-setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [params, group]);

  const myPendingPermission = useMemo(() => {
    if (!group) return null;
    const myKey = getLicense()?.key;
    return (
      group.members.find(
        (m) =>
          m.inviteStatus === "accepted" &&
          m.permission === "edit" &&
          !m.permissionAccepted &&
          m.role === "member" &&
          (!myKey || !m.invitedLicenseKey || m.invitedLicenseKey.startsWith(myKey.slice(0, 8))),
      ) || null
    );
  }, [group]);

  async function buy(e: FormEvent) {
    e.preventDefault();
    if (!selectedPrice) return;
    setBusy(true);
    setError(null);
    try {
      const data = await startGroupCheckout(devices, durationDays);
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not start Group Sharing checkout.");
    }
  }

  async function renew() {
    if (!group) return;
    setBusy(true);
    setError(null);
    try {
      const data = await startGroupCheckout(group.maxDevices, group.durationDays, group.id);
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not start renewal checkout.");
    }
  }

  async function finishSetup(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    setBusy(true);
    setError(null);
    try {
      const data = await setupGroup(group.id, setupName);
      setGroup(data.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save group setup.");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    setBusy(true);
    setError(null);
    try {
      const data = await inviteToGroup({
        groupId: group.id,
        email: inviteEmail.trim() || undefined,
        inviteLicenseKey: inviteKey.trim() || undefined,
        permission: invitePermission,
        displayName: inviteName.trim() || undefined,
      });
      setGroup(data.group);
      setInviteEmail("");
      setInviteKey("");
      setInviteName("");
      if (data.emailSent === false) {
        setError(data.emailError || "Invite saved, but the email could not be sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function viewMemberChecklist(ownerLicenseId: string, ownerName: string) {
    if (!group) return;
    setBusy(true);
    setError(null);
    try {
      const data = await pullSharedChecklist(group.id, ownerLicenseId);
      setGroupViewing({
        groupId: group.id,
        ownerLicenseId: data.ownerLicenseId,
        ownerName: data.ownerName || ownerName,
        permission: data.permission === "own" ? "own" : data.permission,
        canEdit: data.canEdit,
        items: data.items,
        customItems: data.customItems,
      });
      navigate("/app/lists");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that checklist.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="group-sharing-page group-sharing-loading" role="status" aria-label="Loading Group Sharing">
        <div className="group-sharing-loader" aria-hidden="true" />
        <p className="muted">Loading Group Sharing…</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="group-sharing-page">
        <header className="group-sharing-hero group-sharing-hero-promo">
          <div className="group-sharing-hero-copy">
            <p className="eyebrow">Group Sharing</p>
            <h1 className="page-title">Host your own Group Sharing</h1>
            <p className="muted group-sharing-lead">
              Friends and household members can share checklists for a short window. Everyone still needs their own
              Safety Prep List license on their device — Group Sharing is temporary sync, not a shared login.
            </p>
          </div>
          <figure className="group-sharing-hero-media">
            <img
              src="/images/group-sharing-host.jpg"
              width={960}
              height={720}
              alt="People reviewing preparedness checklists together at a kitchen table"
            />
          </figure>
        </header>

        <section className="account-card group-sharing-card">
          <h2>How it works</h2>
          <ul className="group-sharing-ticks">
            <li>Every participant needs their own valid Basic or Pro license on their device.</li>
            <li>You pay once and become the host automatically.</li>
            <li>Invite up to 3 other licensed devices (4 total including you).</li>
            <li>Internet is required while sharing. Offline personal checklists stay unchanged.</li>
            <li>When the session ends or expires, shared access stops. Licenses stay active.</li>
          </ul>
        </section>

        <section className="account-card group-sharing-card">
          <h2>Sizes, durations, and pricing</h2>
          <p className="muted">One-time prices. No subscriptions.</p>
          <div className="group-pricing-table" role="table" aria-label="Group Sharing prices">
            <div className="group-pricing-row head" role="row">
              <span role="columnheader">Devices</span>
              <span role="columnheader">7 days</span>
              <span role="columnheader">14 days</span>
              <span role="columnheader">30 days</span>
            </div>
            {SIZES.map((size) => (
              <div className="group-pricing-row" role="row" key={size}>
                <span role="cell">{size}</span>
                {DURATIONS.map((days) => {
                  const row = GROUP_SHARING_PRICES.find((p) => p.devices === size && p.durationDays === days);
                  return (
                    <span role="cell" key={`${size}-${days}`}>
                      {row ? money(row.cents) : "—"}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="account-card group-sharing-card">
          <h2>Start Group Sharing</h2>
          <form className="group-buy-form" onSubmit={(e) => void buy(e)}>
            <label className="field">
              <span>Licensed devices (including you)</span>
              <select value={devices} onChange={(e) => setDevices(Number(e.target.value))}>
                {SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} devices
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Duration</span>
              <select value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
                {DURATIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
            </label>
            <p className="group-offer-price">
              {selectedPrice ? money(selectedPrice.cents) : "—"} <span>one-time</span>
            </p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || !selectedPrice}>
              {busy ? "Redirecting…" : "Purchase Group Sharing"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  if (group.status === "pending_setup" && group.isHost) {
    return (
      <div className="group-sharing-page" id="group-setup">
        <header className="group-sharing-hero">
          <p className="eyebrow">Purchase confirmed</p>
          <h1 className="page-title">Thank you — set up your group</h1>
          <p className="muted">
            Your Group Sharing pass is ready. Name your group below to start your access window, then invite other
            licensed devices.
          </p>
        </header>
        <section className="account-card group-sharing-card">
          <form onSubmit={(e) => void finishSetup(e)}>
            <label className="field">
              <span>Group name</span>
              <input
                required
                minLength={2}
                maxLength={80}
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="e.g. Smith Family Prep"
              />
            </label>
            <p className="muted">
              {group.maxDevices} devices · {group.durationDays} days · timer starts when you save
            </p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Start group & invite"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  const accepted = group.members.filter((m) => m.inviteStatus === "accepted");

  return (
    <div className="group-sharing-page">
      <header className="group-sharing-hero">
        <p className="eyebrow">Group Sharing</p>
        <h1 className="page-title">{group.name || "Active group"}</h1>
        <p className="muted group-sharing-lead">
          Host · {group.isHost ? "You" : "Organizer"} · {formatRemaining(group.remainingMs)} · {group.memberCount}/
          {group.maxDevices} licensed devices
        </p>
      </header>

      {groupViewing ? (
        <div className="group-viewing-banner" role="status">
          <p>
            YOU ARE CURRENTLY VIEWING {groupViewing.ownerName.toUpperCase()}&apos;S CHECKLIST · Permission{" "}
            {groupViewing.canEdit ? "EDIT" : "VIEW ONLY"}
          </p>
          <button className="btn btn-ghost" type="button" onClick={() => clearGroupViewing()}>
            Return to my checklist
          </button>
        </div>
      ) : null}

      {myPendingPermission ? (
        <section className="account-card group-sharing-card">
          <h2>Permission update</h2>
          <p>The host wants to grant you Edit access. Approve to allow edits to your shared checklist.</p>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() =>
              void acceptPermissionChange(group.id)
                .then((data) => setGroup(data.group))
                .catch((err) => setError(err instanceof Error ? err.message : "Could not accept permission."))
            }
          >
            Approve Edit access
          </button>
        </section>
      ) : null}

      <section className="account-card group-sharing-card">
        <h2>Members</h2>
        <ul className="group-member-list">
          {group.members.map((member) => (
            <li key={member.id}>
              <div>
                <strong>
                  {member.displayName}
                  {member.role === "host" ? " · Host" : ""}
                </strong>
                <p className="muted">
                  {member.inviteStatus}
                  {member.inviteStatus === "accepted"
                    ? ` · ${member.permissionAccepted ? member.permission : `${member.permission} (awaiting consent)`}`
                    : ""}
                  {member.invitedEmail ? ` · ${member.invitedEmail}` : ""}
                </p>
              </div>
              <div className="group-member-actions">
                {member.inviteStatus === "accepted" && member.licenseId ? (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => void viewMemberChecklist(member.licenseId!, member.displayName)}
                  >
                    View checklist
                  </button>
                ) : null}
                {group.isHost && member.role !== "host" && member.inviteStatus === "pending" ? (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void resendInvite(group.id, member.id)
                        .then((data) => setGroup(data.group))
                        .catch((err) => setError(err instanceof Error ? err.message : "Could not resend."))
                    }
                  >
                    Resend
                  </button>
                ) : null}
                {group.isHost && member.role !== "host" && member.inviteStatus !== "revoked" ? (
                  <>
                    {member.inviteStatus === "accepted" ? (
                      <select
                        aria-label={`Permission for ${member.displayName}`}
                        value={member.permission}
                        disabled={busy}
                        onChange={(e) =>
                          void setMemberPermission(group.id, member.id, e.target.value as GroupPermission)
                            .then((data) => setGroup(data.group))
                            .catch((err) => setError(err instanceof Error ? err.message : "Could not update permission."))
                        }
                      >
                        <option value="view">View only</option>
                        <option value="edit">Edit</option>
                      </select>
                    ) : null}
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void revokeMember(group.id, member.id)
                          .then((data) => setGroup(data.group))
                          .catch((err) => setError(err instanceof Error ? err.message : "Could not revoke."))
                      }
                    >
                      {member.inviteStatus === "pending" ? "Revoke" : "Remove"}
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {group.isHost && group.status === "active" ? (
        <section className="account-card group-sharing-card">
          <h2>Invite a licensed member</h2>
          <p className="muted">
            Capacity {accepted.length}/{group.maxDevices}. Invite by purchase email or license key. They must accept on
            the device where that license is activated.
          </p>
          <form className="group-invite-form" onSubmit={(e) => void sendInvite(e)}>
            <label className="field">
              <span>Display name (optional)</span>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Alex" />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@email.com"
              />
            </label>
            <label className="field">
              <span>Or license key</span>
              <input
                value={inviteKey}
                onChange={(e) => setInviteKey(e.target.value)}
                placeholder="SPL-…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>Permission</span>
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value as GroupPermission)}
              >
                <option value="view">View only (default)</option>
                <option value="edit">Edit</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send invitation"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="account-card group-sharing-card">
        <h2>Session</h2>
        <p className="muted">
          Expires {group.expiresAt ? new Date(group.expiresAt).toLocaleString() : "after setup"} ·{" "}
          {formatRemaining(group.remainingMs)}
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="group-session-actions">
          {group.isHost ? (
            <>
              <button className="btn btn-forest" type="button" disabled={busy} onClick={() => void renew()}>
                Renew
              </button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setEndConfirm(true)}>
                End group
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy}
              onClick={() =>
                void leaveGroup(group.id)
                  .then(() => {
                    clearGroupViewing();
                    void refresh();
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : "Could not leave group."))
              }
            >
              Leave group
            </button>
          )}
          <Link className="btn btn-ghost" to="/app/lists">
            My Checklist
          </Link>
        </div>
      </section>

      {endConfirm ? (
        <ConfirmDialog
          title="End Group Sharing?"
          body="Shared access ends immediately. Temporary shared copies are removed. Everyone keeps their own local checklists and licenses."
          confirmLabel="End group"
          onClose={() => setEndConfirm(false)}
          onConfirm={() =>
            void endGroup(group.id)
              .then(() => {
                setEndConfirm(false);
                clearGroupViewing();
                void refresh();
              })
              .catch((err) => {
                setEndConfirm(false);
                setError(err instanceof Error ? err.message : "Could not end group.");
              })
          }
        />
      ) : null}
    </div>
  );
}
