import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { PayPalCheckout } from "../components/PayPalCheckout";
import { PublicHeader } from "../components/PublicChrome";
import { useApp } from "../context/AppContext";
import { checklistTitle, initialsFrom, permissionLabel, planTypeLabel } from "../lib/identity";
import { money } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import { ACCESS_ANNUAL_CENTS, ACCESS_MONTHLY_CENTS, memberAddBreakdown, type AccessInterval } from "../lib/pricing";
import { Photo } from "../components/Photo";
import { SystemRow } from "./Dashboard";

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
  const monthly = products.find((p) => p.slug === "access_monthly");
  const annual = products.find((p) => p.slug === "access_annual");
  const monthlyCents = monthly?.amount_cents ?? ACCESS_MONTHLY_CENTS;
  const annualCents = annual?.amount_cents ?? ACCESS_ANNUAL_CENTS;
  const addOn = memberAddBreakdown(access);
  const familySize = familyMembers.filter((m) => m.status !== "cancelled").length;

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

  return (
    <div>
      <h1 className="page-title">Manage Family Plan</h1>
      <p className="section-title">{planTypeLabel({ plan: profile?.plan, familySize })}</p>
      <div className="family-card-list">
        {familyMembers.map((member) => (
          <article className="account-card family-person-card" key={member.id}>
            <span className="family-avatar">{initialsFrom(member.displayName)}</span>
            <div>
              <h3>{checklistTitle(member.displayName)}</h3>
              {member.permission !== "own" && !member.pending ? (
                <p className="muted">{permissionLabel(member.permission)}</p>
              ) : null}
              <p className="muted">{member.pending ? "Invitation pending" : member.publicId}</p>
            </div>
            {member.pending ? (
              <div className="toolbar">
                <button className="btn btn-ghost" type="button" onClick={() => void inviteFamilyMember(member.firstName || "", member.lastName || "", member.email || "")}>
                  Resend
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => void cancelInvitation(member.id)}>
                  Cancel
                </button>
              </div>
            ) : member.permission !== "own" ? (
              <div className="toolbar">
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
          </article>
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
          Adds one Personal Checklist. Existing members are not billed again.
        </p>
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
                <small>$9.99/month, billed annually</small>
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
              <PayPalCheckout
                productSlug="core"
                quantity={1}
                accessInterval={access}
                onError={setError}
                onCaptured={async () => {
                  await inviteFamilyMember(first.trim(), last.trim(), email.trim());
                  setPaying(false);
                  setAdding(false);
                  await refreshAccount();
                }}
              />
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
              <p>{permissionLabel(person.permission)}</p>
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
  const fullSystems = catalog.systems.filter((s) => s.access_tier === "full");

  useEffect(() => {
    if (viewing.kind !== "household") void switchChecklist("household");
  }, [viewing.kind, switchChecklist]);

  if (!hasSurvivalVault) {
    return (
      <div className="locked-panel">
        <p className="eyebrow">Survival Vault</p>
        <h2>Want to go beyond the basics?</h2>
        <p className="muted">
          Add Survival Vault to an Individual Plan or Family Plan for off-grid preparedness, water purification, backup
          battery and solar, emergency heating and cooling, long-term food, and How-To Videos. $10 one time, not $10
          per person.
        </p>
        <Link className="btn btn-primary" style={{ marginTop: 16 }} to="/app/account#addons">
          Add Survival Vault
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Survival Vault</h1>
      <div className="system-list" style={{ marginTop: 18 }}>
        {fullSystems.map((system) => (
          <SystemRow key={system.id} slug={system.slug} />
        ))}
        <article className="system-card">
          <div className="illu">
            <Photo alt="How-To Videos" subject="video" ratio="square" accent="forest" />
          </div>
          <div className="body">
            <div className="time">Watch</div>
            <h3>How-To Videos</h3>
            <p>Curated visual guides for water, power, off-grid, food, and home readiness skills.</p>
            <Link className="btn btn-moss" to="/app/survival/videos">
              Open How-To Videos
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}

export function InviteClaimPage() {
  return (
    <div className="checkout-stage">
      <div
        className="checkout-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <div className="checkout-panel">
        <BrandMark />
        <p className="eyebrow">Family Plan</p>
        <h1>Set Up My Checklist</h1>
        <p className="muted">
          Someone purchased a Safety Prep Checklist for you. Create or sign in to your account to claim it. After that,
          you own the checklist and choose who can view or edit it.
        </p>
        <Link className="btn btn-primary btn-block" to="/create-account">
          Set Up My Checklist
        </Link>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
