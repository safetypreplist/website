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
  fetchInviteLink,
  formatRemaining,
  inviteToGroup,
  leaveGroup,
  priceFor,
  pullSharedChecklist,
  resendInvite,
  respondToInviteInApp,
  revokeMember,
  seatsFor,
  setMemberPermission,
  setupGroup,
  startGroupCheckout,
  type GroupMember,
  type GroupPermission,
  type GroupSession,
  type InviteResponse,
  type PendingGroupInvite,
  type RenewableGroup,
} from "../lib/groupSharing";

const DURATIONS = [7, 14, 30] as const;
const SIZES = [2, 3, 4] as const;

type Notice = { tone: "ok" | "warning"; text: string };
type InviteResult = { notices: Notice[]; inviteUrl?: string; copied?: boolean };
type LinkState = { memberId: string; url: string; copied: boolean };

function errorText(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function permissionLabel(permission: GroupPermission) {
  return permission === "edit" ? "Edit" : "View only";
}

function statusLabel(status: GroupMember["inviteStatus"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function inviteResultNotices(data: InviteResponse, email: string | undefined): Notice[] {
  const notices: Notice[] = [];
  if (data.emailSent) {
    notices.push({ tone: "ok", text: `Invitation emailed${email ? ` to ${email}` : ""}. You can also copy the invite link below.` });
  } else if (data.emailSent === false) {
    notices.push({
      tone: "warning",
      text: data.emailError || "The invitation was saved, but the email could not be sent. Copy the invite link and send it yourself.",
    });
  } else {
    notices.push({ tone: "ok", text: "Invitation saved." });
  }
  if (data.inviteeLicensed === false) {
    notices.push({
      tone: "warning",
      text: "No active Safety Prep List license uses that email yet. They'll need their own license (bought with that email) to see the invite in the app — or invite them by license key, or send them the invite link.",
    });
  }
  return notices;
}

function NoticeList({ notices }: { notices: Notice[] }) {
  return (
    <>
      {notices.map((notice) => (
        <p key={notice.text} className={`group-notice${notice.tone === "warning" ? " is-warning" : ""}`} role="status">
          {notice.text}
        </p>
      ))}
    </>
  );
}

function InlineError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="form-error" role="alert">
      {text}
    </p>
  );
}

function PendingInvites({
  invites,
  onAnswered,
}: {
  invites: PendingGroupInvite[];
  onAnswered: (message: string) => void;
}) {
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function answer(invite: PendingGroupInvite, accept: boolean) {
    setBusyId(invite.id);
    setErrors((prev) => ({ ...prev, [invite.id]: "" }));
    try {
      await respondToInviteInApp(invite.id, accept);
      onAnswered(
        accept
          ? `You joined ${invite.groupName}. Your checklist is now shared with this group until it ends or you leave.`
          : `You declined the invitation to ${invite.groupName}.`,
      );
    } catch (err) {
      setErrors((prev) => ({ ...prev, [invite.id]: errorText(err, "Could not answer that invitation.") }));
    } finally {
      setBusyId(null);
    }
  }

  if (!invites.length) return null;
  return (
    <section className="account-card group-sharing-card group-invite-inbox" aria-labelledby="group-invites-title">
      <p className="eyebrow">Invitation waiting</p>
      <h2 id="group-invites-title">
        {invites.length === 1 ? "You've been invited to Group Sharing" : `You have ${invites.length} Group Sharing invitations`}
      </h2>
      {invites.map((invite) => (
        <div className="group-invite-card" key={invite.id}>
          <h3>
            {invite.hostName} invited you to {invite.groupName}
          </h3>
          <p className="muted">
            Permission offered: <strong>{permissionLabel(invite.permission)}</strong>
            {invite.expiresAt ? ` · Group ends ${dateTime(invite.expiresAt)}` : ""}
          </p>
          <ul>
            <li>
              {invite.permission === "edit"
                ? "You'll be able to check items and edit notes on other members' shared checklists."
                : "You'll be able to see other members' shared checklists, but not change them."}
            </li>
            <li>While you're in the group, your checklist progress and notes are shared with its members.</li>
            <li>Members with Edit permission can change your shared checklist, and those changes sync to this device.</li>
            <li>You can leave at any time. Your own checklist and license stay on this device.</li>
          </ul>
          <label className="group-consent-line">
            <input
              type="checkbox"
              checked={Boolean(consent[invite.id])}
              onChange={(e) => setConsent((prev) => ({ ...prev, [invite.id]: e.target.checked }))}
            />
            <span>I understand and want to share my checklist with this group.</span>
          </label>
          <InlineError text={errors[invite.id] || null} />
          <div className="group-session-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={busyId === invite.id || !consent[invite.id]}
              onClick={() => void answer(invite, true)}
            >
              {busyId === invite.id ? "Working…" : "Accept invitation"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busyId === invite.id}
              onClick={() => void answer(invite, false)}
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function RenewChoice({
  durationDays,
  setDurationDays,
  devices,
  currentEnd,
}: {
  durationDays: number;
  setDurationDays: (days: number) => void;
  devices: number;
  currentEnd: string | null;
}) {
  const price = priceFor(devices, durationDays);
  const base = currentEnd && Date.parse(currentEnd) > Date.now() ? Date.parse(currentEnd) : Date.now();
  const newEnd = new Date(base + durationDays * 86_400_000).toISOString();
  return (
    <div className="group-renew-choice">
      <label className="field">
        <span>Add time</span>
        <select value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
          {DURATIONS.map((days) => {
            const row = priceFor(devices, days);
            return (
              <option key={days} value={days}>
                {days} days{row ? ` — ${money(row.cents)}` : ""}
              </option>
            );
          })}
        </select>
      </label>
      <p className="muted">
        Same group, same members, {devices} devices. {currentEnd && Date.parse(currentEnd) > Date.now()
          ? `The time is added to your current end date (${dateTime(currentEnd)}),`
          : "The new window starts when payment is confirmed,"}{" "}
        so it would run until about <strong>{dateTime(newEnd)}</strong>.
      </p>
      <p className="group-offer-price">
        {price ? money(price.cents) : "—"} <span>one-time</span>
      </p>
    </div>
  );
}

export function GroupSharingPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { setGroupViewing, clearGroupViewing } = useApp();
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingGroupInvite[]>([]);
  const [renewable, setRenewable] = useState<RenewableGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [devices, setDevices] = useState<number>(2);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [renewDays, setRenewDays] = useState<number>(7);
  const [renewOpen, setRenewOpen] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteKey, setInviteKey] = useState("");
  const [invitePermission, setInvitePermission] = useState<GroupPermission>("view");
  const [inviteName, setInviteName] = useState("");
  const [endConfirm, setEndConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const selectedPrice = priceFor(devices, durationDays);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await fetchGroupStatus({ fresh: true });
      setGroup(data.group);
      setPendingInvites(data.pendingInvites || []);
      setRenewable(data.renewable || null);
      if (data.group?.status === "pending_setup" && data.group.name) setSetupName(data.group.name);
      return data;
    } catch (err) {
      setLoadError(errorText(err, "Could not load Group Sharing."));
      setGroup(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().then((data) => {
      if (params.get("renewed") === "1" && data?.group?.expiresAt) {
        setNotice(`Renewal confirmed. ${data.group.name || "Your group"} now runs until ${dateTime(data.group.expiresAt)}.`);
        const next = new URLSearchParams(params);
        next.delete("renewed");
        setParams(next, { replace: true });
      }
    });
  }, [refresh]);

  useEffect(() => {
    if (params.get("setup") === "1" && group?.status === "pending_setup") {
      document.getElementById("group-setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [params, group]);

  const myPendingPermission = useMemo(() => {
    const me = group?.me;
    return Boolean(me && me.role === "member" && me.permission === "edit" && !me.permissionAccepted);
  }, [group]);

  function applyGroup(next: GroupSession | null) {
    setGroup(next);
  }

  async function buy(e: FormEvent) {
    e.preventDefault();
    if (!selectedPrice) return;
    setBusy(true);
    setBuyError(null);
    try {
      const data = await startGroupCheckout(devices, durationDays);
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setBuyError(errorText(err, "Could not start Group Sharing checkout."));
    }
  }

  async function renew(groupId: string, size: number, onError: (message: string) => void) {
    setBusy(true);
    try {
      const data = await startGroupCheckout(size, renewDays, groupId);
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setRenewOpen(false);
      onError(errorText(err, "Could not start renewal checkout."));
    }
  }

  async function finishSetup(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    setBusy(true);
    setSetupError(null);
    try {
      const data = await setupGroup(group.id, setupName);
      applyGroup(data.group);
      setNotice("Your group is active. Invite other licensed devices below.");
    } catch (err) {
      setSetupError(errorText(err, "Could not save group setup."));
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    setBusy(true);
    setInviteError(null);
    setInviteResult(null);
    const email = inviteEmail.trim() || undefined;
    try {
      const data = await inviteToGroup({
        groupId: group.id,
        email,
        inviteLicenseKey: inviteKey.trim() || undefined,
        permission: invitePermission,
        displayName: inviteName.trim() || undefined,
      });
      applyGroup(data.group);
      setInviteEmail("");
      setInviteKey("");
      setInviteName("");
      setInvitePermission("view");
      setInviteResult({ notices: inviteResultNotices(data, email), inviteUrl: data.inviteUrl });
    } catch (err) {
      setInviteError(errorText(err, "Could not send invitation."));
    } finally {
      setBusy(false);
    }
  }

  async function memberAction(run: () => Promise<{ group: GroupSession | null } | void>, success: string | null) {
    setBusy(true);
    setMemberError(null);
    setMemberNotice(null);
    setInviteResult(null);
    try {
      const data = await run();
      if (data && "group" in data) applyGroup(data.group);
      if (success) setMemberNotice(success);
      setInviteError(null);
    } catch (err) {
      setMemberError(errorText(err, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink(member: GroupMember) {
    if (!group) return;
    setBusy(true);
    setMemberError(null);
    try {
      const data = await fetchInviteLink(group.id, member.id);
      const copied = await copyText(data.inviteUrl);
      setLinkState({ memberId: member.id, url: data.inviteUrl, copied });
    } catch (err) {
      setMemberError(errorText(err, "Could not get the invite link."));
    } finally {
      setBusy(false);
    }
  }

  async function resend(member: GroupMember) {
    if (!group) return;
    setBusy(true);
    setMemberError(null);
    setMemberNotice(null);
    setInviteResult(null);
    try {
      const data = await resendInvite(group.id, member.id);
      applyGroup(data.group);
      const notices = inviteResultNotices(data, member.invitedEmail || undefined).filter((n) => n.tone === "warning" || data.emailSent);
      setMemberNotice(notices.map((n) => n.text).join(" "));
      if (data.inviteUrl) setLinkState({ memberId: member.id, url: data.inviteUrl, copied: false });
    } catch (err) {
      setMemberError(errorText(err, "Could not resend."));
    } finally {
      setBusy(false);
    }
  }

  async function viewMemberChecklist(member: GroupMember) {
    if (!group || !member.licenseId) return;
    setBusy(true);
    setMemberError(null);
    try {
      const data = await pullSharedChecklist(group.id, member.licenseId);
      setGroupViewing({
        groupId: group.id,
        ownerLicenseId: data.ownerLicenseId,
        ownerName: data.ownerName || member.displayName,
        permission: data.permission === "own" ? "own" : data.permission,
        canEdit: data.canEdit,
        items: data.items,
        customItems: data.customItems,
      });
      navigate("/app/lists");
    } catch (err) {
      setMemberError(errorText(err, "Could not open that checklist."));
    } finally {
      setBusy(false);
    }
  }

  const answeredInvite = useCallback(
    (message: string) => {
      setNotice(message);
      void refresh();
    },
    [refresh],
  );

  if (loading) {
    return (
      <div className="group-sharing-page group-sharing-loading" role="status" aria-label="Loading Group Sharing">
        <div className="group-sharing-loader" aria-hidden="true" />
        <p className="muted">Loading Group Sharing…</p>
      </div>
    );
  }

  const pageNotice = notice ? <NoticeList notices={[{ tone: "ok", text: notice }]} /> : null;
  const inbox = <PendingInvites invites={pendingInvites} onAnswered={answeredInvite} />;

  if (!group) {
    return (
      <div className="group-sharing-page">
        {pageNotice}
        <InlineError text={loadError} />
        {inbox}
        {renewable ? (
          <section className="account-card group-sharing-card">
            <p className="eyebrow">Group ended</p>
            <h2>Renew {renewable.name || "your group"}?</h2>
            <p className="muted">
              Your group expired{renewable.expiredAt ? ` on ${dateTime(renewable.expiredAt)}` : ""}. Shared copies were
              removed; everyone kept their own checklists and licenses. Renew to restart sharing with the same members —
              they don&apos;t need to accept again.
            </p>
            <RenewChoice
              durationDays={renewDays}
              setDurationDays={setRenewDays}
              devices={renewable.maxDevices}
              currentEnd={null}
            />
            <InlineError text={sessionError} />
            <button
              className="btn btn-forest"
              type="button"
              disabled={busy}
              onClick={() => {
                setSessionError(null);
                void renew(renewable.id, renewable.maxDevices, setSessionError);
              }}
            >
              {busy ? "Redirecting…" : "Renew group"}
            </button>
          </section>
        ) : null}
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
            <li>Invited people see the invitation under Group Sharing on their licensed device, or open the invite link.</li>
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
            <InlineError text={buyError} />
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
        {inbox}
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
            <InlineError text={setupError} />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Start group & invite"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  const seats = seatsFor(group);
  const host = group.members.find((m) => m.role === "host");
  const visibleMembers = group.members.filter(
    (m) => m.inviteStatus === "accepted" || m.inviteStatus === "pending" || group.isHost,
  );

  return (
    <div className="group-sharing-page">
      {pageNotice}
      <InlineError text={loadError} />
      {inbox}
      <header className="group-sharing-hero">
        <p className="eyebrow">Group Sharing</p>
        <h1 className="page-title">{group.name || "Active group"}</h1>
        <p className="muted group-sharing-lead">
          {group.isHost ? "You are the host" : `Hosted by ${host?.displayName || "the host"}`} ·{" "}
          {formatRemaining(group.remainingMs)} · {seats.used} of {seats.max} seats used
        </p>
      </header>

      {myPendingPermission ? (
        <section className="account-card group-sharing-card">
          <h2>Permission update</h2>
          <p>
            The host offered you Edit access. If you approve, you can check items and edit notes on other members&apos;
            shared checklists in this group. Until then you stay View only.
          </p>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() => void memberAction(() => acceptPermissionChange(group.id), "You now have Edit access in this group.")}
          >
            Approve Edit access
          </button>
        </section>
      ) : null}

      <section className="account-card group-sharing-card">
        <h2>Members</h2>
        <ul className="group-member-list">
          {visibleMembers.map((member) => (
            <li key={member.id}>
              <div>
                <strong>
                  {member.displayName}
                  {member.isYou ? " (You)" : ""}
                  {member.role === "host" ? " · Host" : ""}
                </strong>
                <p className="muted group-member-meta">
                  {statusLabel(member.inviteStatus)}
                  {member.role === "member" && (member.inviteStatus === "accepted" || member.inviteStatus === "pending")
                    ? ` · ${permissionLabel(member.permission)}${
                      member.inviteStatus === "accepted" && member.permission === "edit" && !member.permissionAccepted
                        ? member.isYou
                          ? " (waiting for your approval)"
                          : " (waiting for their approval)"
                        : ""
                    }`
                    : ""}
                  {member.invitedEmail ? ` · ${member.invitedEmail}` : ""}
                </p>
                {group.isHost && member.inviteStatus === "pending" ? (
                  <p
                    className={`muted group-member-meta group-member-email-status${
                      member.emailStatus === "failed" || member.emailStatus === "not_sent" ? " is-failed" : ""
                    }`}
                  >
                    {member.emailStatus === "sent"
                      ? `Invite emailed ${dateTime(member.inviteSentAt)}`
                      : member.emailStatus === "failed"
                        ? "Email could not be sent — copy the invite link and send it yourself"
                        : member.emailStatus === "not_sent"
                          ? "Not emailed — copy the invite link and send it yourself"
                          : `Invited ${dateTime(member.inviteSentAt)}`}
                  </p>
                ) : null}
                {linkState?.memberId === member.id ? (
                  <div className="group-notice">
                    {linkState.copied ? "Invite link copied. " : "Copy this invite link: "}
                    They must open it on the device where their license is activated.
                    <input
                      className="group-link-field"
                      readOnly
                      value={linkState.url}
                      aria-label="Invite link"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                ) : null}
              </div>
              <div className="group-member-actions">
                {member.isYou ? (
                  <Link className="btn btn-ghost" to="/app/lists">
                    Open my checklist
                  </Link>
                ) : member.inviteStatus === "accepted" && member.licenseId ? (
                  <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void viewMemberChecklist(member)}>
                    View checklist
                  </button>
                ) : null}
                {group.isHost && member.role !== "host" && member.inviteStatus === "pending" ? (
                  <>
                    <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void copyInviteLink(member)}>
                      Copy invite link
                    </button>
                    <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void resend(member)}>
                      Resend
                    </button>
                  </>
                ) : null}
                {group.isHost &&
                member.role !== "host" &&
                (member.inviteStatus === "accepted" || member.inviteStatus === "pending") ? (
                  <>
                    <select
                      aria-label={`Permission for ${member.displayName}`}
                      value={member.permission}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value as GroupPermission;
                        void memberAction(
                          () => setMemberPermission(group.id, member.id, next),
                          next === "edit" && member.inviteStatus === "accepted"
                            ? `${member.displayName} will get Edit access once they approve it.`
                            : `${member.displayName} is now ${permissionLabel(next)}.`,
                        );
                      }}
                    >
                      <option value="view">View only</option>
                      <option value="edit">Edit</option>
                    </select>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (linkState?.memberId === member.id) setLinkState(null);
                        void memberAction(
                          () => revokeMember(group.id, member.id),
                          member.inviteStatus === "pending"
                            ? `Invitation for ${member.displayName} revoked. That seat is free again.`
                            : `${member.displayName} was removed. That seat is free again.`,
                        );
                      }}
                    >
                      {member.inviteStatus === "pending" ? "Revoke" : "Remove"}
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {memberNotice ? <NoticeList notices={[{ tone: "ok", text: memberNotice }]} /> : null}
        <InlineError text={memberError} />
      </section>

      {group.isHost && group.status === "active" ? (
        <section className="account-card group-sharing-card">
          <h2>Invite a licensed member</h2>
          <p className="group-seat-line">
            Seats: {seats.used} of {seats.max} used — {seats.accepted} in the group (including you)
            {seats.pending ? `, ${seats.pending} invite${seats.pending === 1 ? "" : "s"} waiting` : ""}.
          </p>
          {seats.full ? (
            <p className="group-notice is-warning" role="status">
              This group is full. Revoke a pending invite or remove a member to free a seat.
            </p>
          ) : (
            <p className="muted">
              Invite by the email on their license, or by their license key. They accept on the device where that license
              is activated — the invite shows up under Group Sharing there, and you can also send them the invite link.
            </p>
          )}
          <form className="group-invite-form" onSubmit={(e) => void sendInvite(e)}>
            <fieldset disabled={seats.full || busy} className="group-invite-fields">
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
              <button className="btn btn-primary" type="submit">
                {busy ? "Sending…" : "Send invitation"}
              </button>
            </fieldset>
          </form>
          <InlineError text={inviteError} />
          {inviteResult ? (
            <>
              <NoticeList notices={inviteResult.notices} />
              {inviteResult.inviteUrl ? (
                <div className="group-notice">
                  Invite link (open on their licensed device):
                  <input
                    className="group-link-field"
                    readOnly
                    value={inviteResult.inviteUrl}
                    aria-label="Invite link"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() =>
                      void copyText(inviteResult.inviteUrl || "").then((copied) =>
                        setInviteResult((prev) => (prev ? { ...prev, copied } : prev)),
                      )
                    }
                  >
                    {inviteResult.copied ? "Copied" : "Copy invite link"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      <section className="account-card group-sharing-card">
        <h2>Session</h2>
        <p className="muted">
          Ends {group.expiresAt ? dateTime(group.expiresAt) : "after setup"} · {formatRemaining(group.remainingMs)}
        </p>
        <InlineError text={sessionError} />
        <div className="group-session-actions">
          {group.isHost ? (
            <>
              <button
                className="btn btn-forest"
                type="button"
                disabled={busy || group.status !== "active"}
                onClick={() => {
                  setSessionError(null);
                  setRenewDays(group.durationDays || 7);
                  setRenewOpen(true);
                }}
              >
                Renew / add time
              </button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setEndConfirm(true)}>
                End group
              </button>
            </>
          ) : (
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setLeaveConfirm(true)}>
              Leave group
            </button>
          )}
          <Link className="btn btn-ghost" to="/app/lists">
            My Checklist
          </Link>
        </div>
      </section>

      {renewOpen ? (
        <ConfirmDialog
          title={`Add time to ${group.name || "your group"}?`}
          confirmLabel="Continue to payment"
          busy={busy}
          onClose={() => setRenewOpen(false)}
          onConfirm={() => renew(group.id, group.maxDevices, setSessionError)}
        >
          <RenewChoice
            durationDays={renewDays}
            setDurationDays={setRenewDays}
            devices={group.maxDevices}
            currentEnd={group.expiresAt}
          />
        </ConfirmDialog>
      ) : null}

      {endConfirm ? (
        <ConfirmDialog
          title="End Group Sharing?"
          body="Shared access ends immediately. Temporary shared copies are removed. Everyone keeps their own local checklists and licenses."
          confirmLabel="End group"
          busy={busy}
          onClose={() => setEndConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await endGroup(group.id);
              setEndConfirm(false);
              clearGroupViewing();
              setNotice("Group Sharing ended. Everyone keeps their own checklists and licenses.");
              await refresh();
            } catch (err) {
              setEndConfirm(false);
              setSessionError(errorText(err, "Could not end group."));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {leaveConfirm ? (
        <ConfirmDialog
          title={`Leave ${group.name || "this group"}?`}
          body="Your shared copy is removed from the group and you stop seeing other members' checklists. Your own checklist stays on this device."
          confirmLabel="Leave group"
          busy={busy}
          onClose={() => setLeaveConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await leaveGroup(group.id);
              setLeaveConfirm(false);
              clearGroupViewing();
              setNotice(`You left ${group.name || "the group"}. Your own checklist is unchanged.`);
              await refresh();
            } catch (err) {
              setLeaveConfirm(false);
              setSessionError(errorText(err, "Could not leave group."));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
