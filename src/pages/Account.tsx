import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OfflineSwitch } from "../components/OfflineStatus";
import { SurvivalVaultPurchase } from "../components/SurvivalVaultPurchase";
import { ProfileWeather } from "../components/LocationStatus";
import { useApp } from "../context/AppContext";
import { formatDate } from "../lib/format";
import { checklistTitle, familyPageLabel, initialsFrom, personName, planTypeLabel } from "../lib/identity";
import { PHOTO_LIBRARY } from "../lib/photos";
import { HOW_TO_PLAYLIST_URL, HOW_TO_VIDEOS_DESCRIPTION, HOW_TO_VIDEOS_DISCLAIMER, VAULT_APP_DESCRIPTION } from "../lib/copy";
import { invokeFunction } from "../lib/supabase";

export function AccountPage() {
  const {
    profile,
    signOut,
    changePassword,
    user,
    devices,
    updateProfile,
    uploadAvatar,
    myChecklist,
    familyMembers,
    hasSurvivalVault,
    catalog,
    progress,
    customItems,
    contacts,
    demoMode,
    refreshAccount,
  } = useApp();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [first, setFirst] = useState(profile?.first_name || "");
  const [last, setLast] = useState(profile?.last_name || "");
  const [display, setDisplay] = useState(profile?.display_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState("");
  const [copied, setCopied] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const cancellable = !demoMode && (profile?.access_status === "active" || profile?.access_status === "past_due") && Boolean(profile?.access_ends_at);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const used = devices.length;
  const familySize = familyMembers.filter((m) => m.status !== "cancelled").length || 1;
  const planName = planTypeLabel({ plan: profile?.plan, familySize });
  const greetingName = personName(profile);
  const welcome = greetingName === "My" ? "Welcome" : `Welcome, ${greetingName}`;

  useEffect(() => {
    setFirst(profile?.first_name || "");
    setLast(profile?.last_name || "");
    setDisplay(profile?.display_name || "");
    setPhone(profile?.phone || "");
  }, [profile?.first_name, profile?.last_name, profile?.display_name, profile?.phone]);

  useEffect(() => {
    if (location.hash !== "#addons") return;
    document.getElementById("addons")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  async function saveDetails() {
    setError("");
    setSaved("");
    setSaving(true);
    try {
      await updateProfile({
        first_name: first.trim() || null,
        last_name: last.trim() || null,
        display_name: display.trim() || null,
        full_name: [first.trim(), last.trim()].filter(Boolean).join(" ") || null,
        phone: phone.trim() || null,
      });
      setSaved("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save account.");
    } finally {
      setSaving(false);
    }
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    setError("");
    setPhotoBusy(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function savePassword() {
    setError("");
    setPasswordSaved("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await changePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    }
  }

  async function copyId() {
    if (!myChecklist?.publicId) return;
    await navigator.clipboard.writeText(myChecklist.publicId);
    setCopied(true);
  }

  function downloadData() {
    const payload = {
      exported_at: new Date().toISOString(),
      profile: {
        email: user?.email || profile?.email,
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        display_name: profile?.display_name,
        phone: profile?.phone,
        plan: profile?.plan,
        access_interval: profile?.access_interval,
        access_renews_at: profile?.access_renews_at,
      },
      checklist: myChecklist,
      familyMembers: familyMembers.map((member) => ({
        publicId: member.publicId,
        displayName: member.displayName,
        permission: member.permission,
        status: member.status,
      })),
      progress,
      customItems,
      contacts,
      devices: devices.map((device) => ({
        id: device.id,
        nickname: device.nickname,
        device_description: device.device_description,
      })),
      catalogTitles: catalog.items.map((item) => ({ id: item.id, text: item.text })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "safety-prep-list-data.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function cancelSubscription() {
    setCancelBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await invokeFunction<{ accessEndsAt: string | null }>("cancel-paypal-subscription", {});
      await refreshAccount();
      setCancelOpen(false);
      setSaved(
        result?.accessEndsAt
          ? `Subscription cancelled. You keep access until ${formatDate(result.accessEndsAt)}.`
          : "Subscription cancelled.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the subscription.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setError("");
    try {
      if (!demoMode) {
        await invokeFunction("delete-account", { confirm: "DELETE" });
      }
      await signOut({ discardPending: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account.");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="account-page">
      <section className="profile-hero">
        <div className="profile-hero-banner">
          <img src={PHOTO_LIBRARY.landscape} alt="" />
          <ProfileWeather />
        </div>
        <div className="profile-hero-body">
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
          <div className="profile-hero-identity">
            <button
              className={`profile-avatar${photoBusy ? " is-busy" : ""}`}
              type="button"
              disabled={photoBusy}
              onClick={() => fileRef.current?.click()}
              aria-label={photoBusy ? "Saving photo" : profile?.avatar_url ? "Change photo" : "Add a photo"}
              title={profile?.avatar_url ? "Change photo" : "Add a photo"}
            >
              <span className="profile-avatar-face">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" />
                ) : (
                  <span>{initialsFrom(display || first, user?.email)}</span>
                )}
              </span>
              <span className="profile-avatar-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
            </button>
            <div>
              <p className="profile-kicker">Your account</p>
              <h1 className="page-title">{welcome}</h1>
              <p className="profile-hero-meta">{photoBusy ? "Saving photo…" : planName}</p>
            </div>
          </div>
        </div>
      </section>

      <article className="account-card">
        <h2>Your details</h2>
        <p className="muted">Keep your name and contact information current so your checklist stays labeled for you.</p>
        <div className="account-details-grid">
          <label className="account-field">
            <span>First name</span>
            <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" />
          </label>
          <label className="account-field">
            <span>Last name</span>
            <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
          </label>
          <label className="account-field">
            <span>Display name</span>
            <input value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="How your checklist is labeled" />
          </label>
          <label className="account-field">
            <span>Phone number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" inputMode="tel" />
          </label>
          <div className="account-field account-field-wide">
            <span>Email</span>
            <p>{user?.email || profile?.email || "—"}</p>
          </div>
        </div>
        <button className="btn btn-forest" type="button" disabled={saving} onClick={() => void saveDetails()}>
          {saving ? "Saving…" : "Save details"}
        </button>
        {saved ? <p className="account-saved">{saved}</p> : null}
      </article>

      <article className="account-card">
        <h2>Security</h2>
        <p className="muted">Change the password for this account. Your email remains the sign-in username.</p>
        <label className="account-field">
          <span>New password</span>
          <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
        </label>
        <label className="account-field">
          <span>Confirm new password</span>
          <input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Enter it again" />
        </label>
        <button className="btn btn-forest" type="button" onClick={() => void savePassword()}>
          Change password
        </button>
        {passwordSaved ? <p className="account-saved">{passwordSaved}</p> : null}
      </article>

      <article className="account-card">
        <h2>Checklist</h2>
        <p className="account-plan">{checklistTitle(display || first)}</p>
        <div className="account-field" style={{ marginTop: 16 }}>
          <span>Checklist ID</span>
          <p className="account-plan">{myChecklist?.publicId || "—"}</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => void copyId()}>
          {copied ? "Copied" : "Copy Checklist ID"}
        </button>
      </article>

      <article className="account-card">
        <h2>Plan</h2>
        <p className="account-plan">{planName}</p>
        {accessDescription(profile) ? <p className="muted">{accessDescription(profile)}</p> : null}
        <div className="toolbar">
          <Link className="btn btn-ghost" to="/app/family">
            {familyPageLabel(familyMembers)}
          </Link>
          <Link className="btn btn-ghost" to="/app/access">
            Checklist Access
          </Link>
        </div>
      </article>

      <article className="account-card" id="addons">
        <h2>Survival Vault</h2>
        {!hasSurvivalVault && (profile?.plan === "core" || profile?.plan === "full") ? (
          <div className="account-upgrade">
            <h3>Survival Vault</h3>
            <p className="muted">{VAULT_APP_DESCRIPTION}</p>
            <SurvivalVaultPurchase />
          </div>
        ) : hasSurvivalVault ? (
          <div className="addon-owned">
            <Link className="btn btn-primary" to="/app/survival">
              Open Survival Vault
            </Link>
          </div>
        ) : (
          <p className="muted">Purchase a plan first, then add Survival Vault for $10 one time.</p>
        )}
      </article>

      <article className="account-card">
        <h2>Devices</h2>
        <p>
          {used} of {profile?.device_limit ?? 2} active
        </p>
        <Link className="btn btn-ghost" to="/app/devices">
          Manage devices
        </Link>
      </article>

      <article className="account-card">
        <h2>Subscription</h2>
        {accessDescription(profile) ? <p className="muted">{accessDescription(profile)}</p> : null}
        {cancellable ? (
          <>
            <p className="muted">
              Cancel anytime. PayPal stops future charges and you keep access through the period you already paid.{" "}
              <Link to="/contact?topic=cancel">Click here to contact us</Link> if you need help.
            </p>
            <button className="btn btn-ghost" type="button" onClick={() => setCancelOpen(true)}>
              Cancel subscription
            </button>
          </>
        ) : profile?.access_status === "cancelled" ? (
          <p className="muted">
            Your subscription is cancelled and will not renew.{" "}
            <Link to="/contact?topic=cancel">Click here to contact us</Link> if you need help.
          </p>
        ) : profile?.access_status === "expired" ? (
          <Link className="btn btn-primary" to="/app/renew">
            Renew my plan
          </Link>
        ) : (
          <p className="muted">
            There are no renewal charges on this account.{" "}
            <Link to="/contact?topic=cancel">Click here to contact us</Link> with billing questions.
          </p>
        )}
        <div className="account-billing">
          <Link className="btn btn-forest" to="/app/billing">
            Billing &amp; payments
          </Link>
          <p className="muted">See your payment history, download receipts, and change your payment method.</p>
        </div>
      </article>

      <article className="account-card">
        <h2>Your data</h2>
        {!demoMode ? (
          <div className="account-offline">
            <OfflineSwitch />
          </div>
        ) : null}
        <p className="muted">Download a JSON copy of your account, checklist progress, notes, contacts, and devices.</p>
        <div className="toolbar">
          <button className="btn btn-ghost" type="button" onClick={downloadData}>
            Download my data
          </button>
          <button className="btn btn-danger" type="button" onClick={() => setDeleteOpen(true)}>
            Delete my account and data
          </button>
        </div>
      </article>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="btn btn-forest" type="button" onClick={() => void signOut()}>
        Log out
      </button>
      {cancelOpen ? (
        <ConfirmDialog
          title="Cancel your subscription?"
          body={
            profile?.access_renews_at
              ? `PayPal will stop future charges. You keep access until ${formatDate(profile.access_renews_at)}, and your checklists stay saved.`
              : "PayPal will stop future charges. You keep access through the period you already paid, and your checklists stay saved."
          }
          confirmLabel="Cancel subscription"
          danger
          busy={cancelBusy}
          onClose={() => setCancelOpen(false)}
          onConfirm={() => void cancelSubscription()}
        />
      ) : null}
      {deleteOpen ? (
        <ConfirmDialog
          title="Delete your account?"
          body="This cancels any active subscription in PayPal and removes your profile, checklist progress, notes, custom items, contacts, and devices. Purchase records and terms acceptances are kept as required. This cannot be undone."
          confirmLabel="Delete account"
          danger
          busy={deleteBusy}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => void deleteAccount()}
        />
      ) : null}
      {profile?.role === "owner" && (
        <p style={{ marginTop: 16 }}>
          <Link to="/admin">Owner tools</Link>
        </p>
      )}
    </div>
  );
}

function accessDescription(profile: { access_status?: string | null; access_interval?: string | null; access_renews_at?: string | null; access_ends_at?: string | null; plan?: string | null } | null) {
  if (!profile?.plan || profile.plan === "none") return "";
  if (profile.access_status === "grandfathered" || !profile.access_interval) {
    return "Existing Safety Prep List access is included with your account.";
  }
  if (profile.access_status === "cancelled") {
    return profile.access_ends_at ? `Cancelled. Access ends ${formatDate(profile.access_ends_at)}.` : "Cancelled.";
  }
  if (profile.access_status === "expired") {
    return "Access ended. Renew to keep using your checklists.";
  }
  if (profile.access_status === "past_due") {
    return "Your last payment did not go through. Update your payment method in PayPal to keep access.";
  }
  if (profile.access_interval === "annual") {
    return profile.access_renews_at
      ? `Annual. Next renewal ${formatDate(profile.access_renews_at)}.`
      : "Annual.";
  }
  if (profile.access_interval === "monthly") {
    return profile.access_renews_at
      ? `Monthly. Next billing ${formatDate(profile.access_renews_at)}.`
      : "Monthly.";
  }
  return "Safety Prep List access is included with your plan.";
}

export function VaultPage() {
  const { hasSurvivalVault } = useApp();

  if (!hasSurvivalVault) {
    return (
      <div className="locked-panel">
        <p className="eyebrow">How-To Videos</p>
        <h2>Part of Survival Vault</h2>
        <p className="muted">
          How-To Videos come with Survival Vault. Watch the skills when you need them. Practical visual learning for water, power, off grid, food, communications, and home readiness. How-To Videos is a curated YouTube playlist from independent creators and organizations.
        </p>
        <SurvivalVaultPurchase />
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">
        <Link to="/app/survival">Survival Vault</Link>
      </p>
      <h1 className="page-title">How-To Videos</h1>
      <section className="panel how-to-videos">
        <p>{HOW_TO_VIDEOS_DESCRIPTION}</p>
        <p className="how-to-videos-disclaimer">{HOW_TO_VIDEOS_DISCLAIMER}</p>
        <a className="btn btn-primary" href={HOW_TO_PLAYLIST_URL} target="_blank" rel="noopener noreferrer">
          View How-To Videos
        </a>
      </section>
    </div>
  );
}
