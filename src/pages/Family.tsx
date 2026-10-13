import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AutoRenewalNote, LegalAgreement } from "../components/LegalAgreement";
import { PayPalCheckout } from "../components/PayPalCheckout";
import { useApp } from "../context/AppContext";
import { checklistTitle, familyPageLabel, initialsFrom, permissionLabel, planTypeLabel } from "../lib/identity";
import { money } from "../lib/format";
import { VAULT_APP_DESCRIPTION, VAULT_CHECKLISTS } from "../lib/copy";
import { ACCESS_ANNUAL_CENTS, ACCESS_MONTHLY_CENTS, memberAddBreakdown, type AccessInterval } from "../lib/pricing";
import { Photo } from "../components/Photo";
import type { ConnectedChecklist, FamilyInviteResult } from "../types";
import { AccessChoice, type AccessLevel } from "../components/AccessChoice";
import { SystemRow, vaultSystems } from "./Dashboard";
import { SurvivalVaultPurchase } from "../components/SurvivalVaultPurchase";

export function ConnectedChecklistsPage() {
  return <Navigate to="/app/family" replace />;
}

export function ManageFamilyPage() {
  const {
    familyMembers,
    profile,
    products,
    inviteFamilyMember,
    cancelInvitation,
    demoMode,
    refreshAccount,
    switchChecklist,
    setChecklistPermission,
    revokeChecklistAccess,
  } = useApp();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [access, setAccess] = useState<AccessInterval>(profile?.access_interval === "annual" ? "annual" : "monthly");
  const [agreed, setAgreed] = useState(false);
  const [memberAccess, setMemberAccess] = useState<AccessLevel>("view");
  const monthly = products.find((p) => p.slug === "access_monthly");
  const annual = products.find((p) => p.slug === "access_annual");
  const monthlyCents = monthly?.amount_cents ?? ACCESS_MONTHLY_CENTS;
  const annualCents = annual?.amount_cents ?? ACCESS_ANNUAL_CENTS;
  const addOn = memberAddBreakdown(access);
  const familySize = familyMembers.filter((m) => m.status !== "cancelled").length;
  const openSeats = familyMembers.filter((m) => m.pending && !m.email).length;
  const [purchaseNotice, setPurchaseNotice] = useState<InviteNotice | null>(null);

  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (demoMode) {
        await inviteFamilyMember(first.trim(), last.trim(), email.trim());
        setAdding(false);
        setFirst("");
        setLast("");
        setEmail("");
        return;
      }
      setPaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation.");
    }
  }

  async function afterPurchase() {
    const name = first.trim();
    const address = email.trim();
    setPaying(false);
    setAdding(false);
    setAgreed(false);
    try {
      await refreshAccount();
      const result = await inviteFamilyMember(name, last.trim(), address, undefined, memberAccess);
      setPurchaseNotice({ ...result, firstName: result.firstName || name });
    } catch (err) {
      setPurchaseNotice({
        checklistId: "",
        email: address,
        firstName: name,
        emailSent: false,
        inviteUrl: "",
        emailError: err instanceof Error ? err.message : "We couldn't send the invitation.",
      });
      await refreshAccount();
    }
    setFirst("");
    setLast("");
    setEmail("");
    setMemberAccess("view");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <h1 className="page-title" data-onboarding="family">{familyPageLabel(familyMembers)}</h1>
      <p className="section-title">{planTypeLabel({ plan: profile?.plan, familySize })}</p>
      {purchaseNotice ? (
        <PurchaseInviteNotice notice={purchaseNotice} onDismiss={() => setPurchaseNotice(null)} />
      ) : null}
      <div className="family-card-list">
        {familyMembers.map((member) => (
          member.pending ? (
            <PendingSeatCard key={member.id} member={member} onCancel={cancelInvitation} />
          ) : (
          <article className="account-card family-person-card" key={member.id}>
            <span className="family-avatar">{initialsFrom(member.displayName)}</span>
            <div>
              <h3>{checklistTitle(member.displayName)}</h3>
              {member.permission !== "own" ? (
                <p className="muted">
                  {demoMode
                    ? permissionLabel(member.permission)
                    : member.sharedWithMe
                      ? member.permission === "edit"
                        ? "You can edit their checklist"
                        : "You can view their checklist"
                      : "Hasn't shared their checklist with you"}
                </p>
              ) : null}
              <p className="muted">{member.publicId}</p>
            </div>
            {member.permission !== "own" ? (
              <div className="toolbar">
                {member.sharedWithMe || demoMode ? (
                  <button
                    className="btn btn-moss"
                    type="button"
                    onClick={() => {
                      void switchChecklist("personal", member.id);
                      navigate("/app");
                    }}
                  >
                    Open
                  </button>
                ) : null}
                {demoMode ? (
                  <>
                    <button className="btn btn-ghost" type="button" onClick={() => void setChecklistPermission(member.id, "", "view")}>
                      View Only
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => void setChecklistPermission(member.id, "", "edit")}>
                      Can Edit
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => void revokeChecklistAccess(member.id)}>
                      Remove
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            {member.permission !== "own" && !demoMode ? <MemberAccess member={member} /> : null}
          </article>
          )
        ))}
      </div>

      {familyMembers.filter((m) => m.permission !== "own").length === 0 ? (
        <div className="empty-panel">
          <p>No connected checklists yet.</p>
        </div>
      ) : null}

      <div className="account-card" style={{ marginTop: 18 }}>
        <h3>Add a family member</h3>
        <p className="muted">
          Adds one Personal Checklist. Existing members are not billed again. After payment, we email them a link to
          create their own account.
        </p>
        {openSeats > 0 ? (
          <p className="family-open-seat-hint">
            You already have {openSeats === 1 ? "an open seat" : `${openSeats} open seats`} paid for. Add their email
            above to send the invite. There's no need to buy another.
          </p>
        ) : null}
        {!adding ? (
          <button className="btn btn-primary" type="button" onClick={() => setAdding(true)}>
            Add another checklist
          </button>
        ) : (
          <form onSubmit={(e) => void sendInvite(e)}>
            <label className="field">
              <span>First name</span>
              <input required value={first} onChange={(e) => setFirst(e.target.value)} />
            </label>
            <label className="field">
              <span>Last name</span>
              <input required value={last} onChange={(e) => setLast(e.target.value)} />
            </label>
            <label className="field">
              <span>Email</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <AccessChoice name={first} value={memberAccess} onChange={setMemberAccess} />
            <div className="access-choice">
              <button
                type="button"
                className={`access-card ${access === "monthly" ? "selected" : ""}`}
                onClick={() => setAccess("monthly")}
              >
                <b>Monthly</b>
                <span>+{money(monthlyCents)}/month</span>
              </button>
              <button
                type="button"
                className={`access-card ${access === "annual" ? "selected" : ""}`}
                onClick={() => setAccess("annual")}
              >
                <b>Annual</b>
                <span>+{money(annualCents)}/year</span>
                <small>{money(Math.round(annualCents / 12))}/month, billed annually</small>
              </button>
            </div>
            <p className="checkout-due">
              Due today
              <b>{money(addOn.dueTodayCents)}</b>
            </p>
            <p className="muted">
              {access === "annual"
                ? `Renews annually at ${money(addOn.recurringCents)} for this person.`
                : `Then ${money(addOn.recurringCents)}/month for this person.`}
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            {paying && !demoMode ? (
              <>
                <LegalAgreement id="family-agree" checked={agreed} onChange={setAgreed} />
                <AutoRenewalNote
                  amount={money(addOn.recurringCents)}
                  interval={access === "annual" ? "year" : "month"}
                />
                {agreed ? (
                  <PayPalCheckout
                    productSlug="core"
                    quantity={1}
                    accessInterval={access}
                    onError={setError}
                    onCaptured={afterPurchase}
                  />
                ) : (
                  <p className="muted">Agree to the policies above to enable PayPal checkout.</p>
                )}
              </>
            ) : (
              <button className="btn btn-primary" type="submit">
                {demoMode ? "Send invitation" : `Purchase and send invitation, ${money(addOn.dueTodayCents)}`}
              </button>
            )}
          </form>
        )}
      </div>
      <ConnectExisting />
    </div>
  );
}

type InviteNotice = FamilyInviteResult;

function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  return (
    <div className="invite-link-fallback">
      <span>Or send them this link yourself:</span>
      <div className="invite-link-row">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function PurchaseInviteNotice({ notice, onDismiss }: { notice: InviteNotice; onDismiss: () => void }) {
  const name = notice.firstName || "your family member";
  return (
    <section className={`invite-notice ${notice.emailSent ? "" : "is-warning"}`} role="status">
      <p className="invite-notice-title">Payment received. Thank you!</p>
      {notice.emailSent ? (
        <p>
          A link has been sent to your family member at <strong>{notice.email}</strong>. Ask {name} to open it and
          create their account. Until then, their checklist shows as <em>Pending account creation</em> below.
        </p>
      ) : (
        <>
          <p>
            Their checklist is reserved, but we couldn't email {name}
            {notice.email ? <> at <strong>{notice.email}</strong></> : null}.{" "}
            {notice.emailError || ""}
          </p>
          <CopyInviteLink url={notice.inviteUrl} />
        </>
      )}
      <button className="btn btn-ghost" type="button" onClick={onDismiss}>
        Got it
      </button>
    </section>
  );
}

function PendingSeatCard({
  member,
  onCancel,
}: {
  member: ConnectedChecklist;
  onCancel: (checklistId: string) => Promise<void>;
}) {
  const { inviteFamilyMember, resendInvite } = useApp();
  const [permission, setPermission] = useState<AccessLevel>("view");
  const [busy, setBusy] = useState<"" | "send" | "resend" | "cancel">("");
  const [message, setMessage] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const invited = Boolean(member.email);

  function report(result: FamilyInviteResult, verb: string) {
    setMessage(
      result.emailSent
        ? { ok: true, text: `${verb}. Ask ${result.firstName || "them"} to check their inbox (and spam folder) for the link.` }
        : { ok: false, text: result.emailError || "We couldn't send the email.", url: result.inviteUrl },
    );
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy("send");
    setMessage(null);
    try {
      report(await inviteFamilyMember(first.trim(), last.trim(), email.trim(), member.id, permission), "Invite sent");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not send the invitation." });
    } finally {
      setBusy("");
    }
  }

  async function resend() {
    setBusy("resend");
    setMessage(null);
    try {
      report(await resendInvite(member.id), "Invite re-sent");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not resend the invitation." });
    } finally {
      setBusy("");
    }
  }

  async function cancel() {
    setBusy("cancel");
    setMessage(null);
    try {
      await onCancel(member.id);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not cancel the invitation." });
    } finally {
      setBusy("");
    }
  }

  return (
    <article className="account-card family-person-card family-seat-card">
      <span className="family-avatar is-pending">{invited ? initialsFrom(member.displayName) : "+"}</span>
      <div>
        <h3>{invited ? checklistTitle(member.displayName) : "Open seat"}</h3>
        <span className="seat-status">{invited ? "Pending account creation" : "Waiting for an email"}</span>
        <p className="muted">
          {invited
            ? <>Invite sent to <strong>{member.email}</strong></>
            : "Already paid for. Add your family member's email and we'll send them a link to create their account."}
        </p>
      </div>
      {invited ? (
        <div className="toolbar">
          <button className="btn btn-moss" type="button" disabled={Boolean(busy)} onClick={() => void resend()}>
            {busy === "resend" ? "Sending..." : "Resend invite"}
          </button>
          <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => void cancel()}>
            {busy === "cancel" ? "Canceling..." : "Cancel invite"}
          </button>
        </div>
      ) : null}
      {!invited ? (
        <form className="seat-invite-form" onSubmit={(e) => void send(e)}>
          <label className="field">
            <span>First name</span>
            <input required value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            <span>Last name</span>
            <input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            <span>Email</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </label>
          <div className="seat-invite-access">
            <AccessChoice name={first} value={permission} onChange={setPermission} compact />
          </div>
          <button className="btn btn-primary" type="submit" disabled={Boolean(busy)}>
            {busy === "send" ? "Sending..." : "Send invite"}
          </button>
        </form>
      ) : null}
      {invited ? <MemberAccess member={member} /> : null}
      {message ? (
        <div className={`seat-message ${message.ok ? "is-ok" : "is-error"}`} role="status">
          <p>{message.text}</p>
          {message.url ? <CopyInviteLink url={message.url} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function MemberAccess({ member }: { member: ConnectedChecklist }) {
  const { setFamilyAccess } = useApp();
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const firstName = member.firstName || member.displayName.split(" ")[0];

  async function change(level: AccessLevel) {
    setSaving(true);
    setNote("");
    try {
      await setFamilyAccess(member.id, level);
      setNote(level === "edit" ? `${firstName} can now edit your checklist.` : `${firstName} can now view your checklist.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save that change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="member-access">
      <AccessChoice name={firstName} value={member.accessToMine ?? null} onChange={(level) => void change(level)} disabled={saving} compact />
      {!member.accessToMine && !note ? (
        <p className="member-access-note">Not chosen yet. {firstName} can't see your checklist until you pick one.</p>
      ) : null}
      {note ? <p className="member-access-note">{note}</p> : null}
    </div>
  );
}

function ConnectExisting() {
  const [open, setOpen] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="account-card" style={{ marginTop: 18 }}>
      <h3>Connect existing checklist</h3>
      <p className="muted">
        Send a request with their Checklist ID. They must approve before you can see their list.
      </p>
      {!open ? (
        <button className="btn btn-ghost" type="button" onClick={() => setOpen(true)}>
          Connect Existing Checklist
        </button>
      ) : sent ? (
        <p>Request sent. The checklist owner must approve before access is granted.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <label className="field">
            <span>Checklist ID</span>
            <input required value={publicId} onChange={(e) => setPublicId(e.target.value)} placeholder="SPL-847291" />
          </label>
          <button className="btn btn-primary" type="submit">
            Send connection request
          </button>
        </form>
      )}
    </div>
  );
}

export function ChecklistAccessPage() {
  const { myChecklist, familyMembers, setChecklistPermission, revokeChecklistAccess, profile } =
    useApp();
  const people = familyMembers.filter((m) => m.permission !== "own" && !m.pending);

  return (
    <div>
      <h1 className="page-title">Checklist Access</h1>
      <p className="muted">Control who can view or edit {checklistTitle(myChecklist?.displayName || profile?.display_name)}.</p>
      {people.length === 0 ? (
        <p>No one else has access yet.</p>
      ) : (
        people.map((person) => (
          <article className="account-card family-person-card" key={person.id}>
            <div>
              <h3>{person.displayName}</h3>
              <p>
                {person.accessToMine === "edit"
                  ? "Can edit your checklist"
                  : person.accessToMine === "view"
                    ? "Can view your checklist"
                    : "No access to your checklist"}
              </p>
            </div>
            <div className="toolbar">
              <button className="btn btn-ghost" type="button" onClick={() => void setChecklistPermission(myChecklist?.id || "", person.ownerUserId || "", "view")}>
                View Only
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => void setChecklistPermission(myChecklist?.id || "", person.ownerUserId || "", "edit")}>
                Can Edit
              </button>
              <button className="btn btn-danger" type="button" onClick={() => void revokeChecklistAccess(myChecklist?.id || "", person.ownerUserId || undefined)}>
                Remove Access
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

export function HouseholdPage() {
  const { catalog, hasSurvivalVault, viewing, switchChecklist } = useApp();
  const videos = VAULT_CHECKLISTS.find((item) => item.title === "How-To Videos");

  useEffect(() => {
    if (viewing.kind !== "household") void switchChecklist("household");
  }, [viewing.kind, switchChecklist]);

  if (!hasSurvivalVault) {
    return (
      <div className="locked-panel">
        <p className="eyebrow">Survival Vault</p>
        <h2>Want to go beyond the basics?</h2>
        <p className="muted">{VAULT_APP_DESCRIPTION}</p>
        <SurvivalVaultPurchase />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Survival Vault</h1>
      <div className="system-list" style={{ marginTop: 18 }}>
        {vaultSystems(catalog.systems).map((system) => (
          <SystemRow
            key={system.id}
            slug={system.slug}
            copy={VAULT_CHECKLISTS.find((item) => (
              (system.slug === "off-grid" && item.title === "Off-Grid Systems") ||
              (system.slug === "water-purification" && item.title === "Water Purification") ||
              (system.slug === "battery-solar" && item.title === "Home Battery & Solar") ||
              (system.slug === "cooling-heat" && item.title === "Emergency Cooling / Heat Resilience") ||
              (system.slug === "long-term-food" && item.title === "Long-Term Food")
            ))}
          />
        ))}
        {videos ? (
          <article className="system-card">
            <div className="illu">
              <Photo alt="How-To Videos" subject="video" ratio="square" accent="forest" />
            </div>
            <div className="body">
              <h3>{videos.title}</h3>
              <p>{videos.line}</p>
              <p>{videos.detail}</p>
              <Link className="btn btn-moss" to="/app/survival/videos">
                Open videos
              </Link>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}

