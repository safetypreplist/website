import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LegalAgreement } from "../components/LegalAgreement";
import { PayPalCheckout } from "../components/PayPalCheckout";
import { ProfileWeather } from "../components/LocationStatus";
import { useApp } from "../context/AppContext";
import { formatDate } from "../lib/format";
import { checklistTitle, initialsFrom, personName, planTypeLabel } from "../lib/identity";
import { PHOTO_LIBRARY } from "../lib/photos";
import { SURVIVAL_VAULT_DESCRIPTION } from "../lib/pricing";
import { invokeFunction, isSupabaseConfigured, supabase } from "../lib/supabase";

export function AccountPage() {
  const {
    profile,
    signOut,
    changePassword,
    refreshAccount,
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
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [vaultAgreed, setVaultAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(Boolean(profile?.cancel_requested_at));
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

  async function requestCancel() {
    setError("");
    setSaved("");
    if (isSupabaseConfigured() && user?.id) {
      const { error: err } = await supabase
        .from("profiles")
        .update({ cancel_requested_at: new Date().toISOString() })
        .eq("id", user.id);
      if (err) {
        setError("We saved your request locally. Use the contact form to finish cancellation.");
      }
    }
    setCancelRequested(true);
    navigate("/contact?topic=cancel");
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setError("");
    try {
      if (!demoMode) {
        await invokeFunction("delete-account", { confirm: "DELETE" });
      }
      await signOut();
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
              className="profile-avatar"
              type="button"
              disabled={photoBusy}
              onClick={() => fileRef.current?.click()}
              aria-label={profile?.avatar_url ? "Change photo" : "Upload photo"}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <span>{initialsFrom(display || first, user?.email)}</span>
              )}
            </button>
            <div>
              <p className="profile-kicker">Your profile</p>
              <h1 className="page-title">{welcome}</h1>
              <p className="profile-hero-meta">{planName}</p>
              <button className="profile-photo-link" type="button" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                {photoBusy ? "Saving photo…" : profile?.avatar_url ? "Change photo" : "Upload photo"}
              </button>
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
            Manage Family Plan
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
            <p className="muted">{SURVIVAL_VAULT_DESCRIPTION}</p>
            <button className="btn btn-primary" type="button" onClick={() => setShowUpgrade(true)}>
              Add Survival Vault
            </button>
            {showUpgrade && (
              <div style={{ marginTop: 16 }}>
                {error && <p className="form-error">{error}</p>}
                <LegalAgreement id="vault-agree" checked={vaultAgreed} onChange={setVaultAgreed} />
                {vaultAgreed ? (
                  <PayPalCheckout
                    productSlug="upgrade_full"
                    onError={setError}
                    onCaptured={async () => {
                      await refreshAccount();
                      setShowUpgrade(false);
                    }}
                  />
                ) : (
                  <p className="muted">Agree to the policies above to enable PayPal checkout.</p>
                )}
              </div>
            )}
          </div>
        ) : hasSurvivalVault ? (
          <div className="addon-owned">
            <Link className="btn btn-ghost" to="/app/survival">
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
        {cancelRequested ? (
          <p>
            Cancellation requested. You keep access through the end of the paid period.{" "}
            <Link to="/contact?topic=cancel">Click here to contact us</Link> if you need help.
          </p>
        ) : (
          <>
            <p className="muted">
              Cancel anytime before the next billing date. We record the request.{" "}
              <Link to="/contact?topic=cancel">Click here to contact us</Link> if you need help. You keep access through the period you already paid.
            </p>
            <button className="btn btn-ghost" type="button" onClick={() => void requestCancel()}>
              Cancel subscription
            </button>
          </>
        )}
      </article>

      <article className="account-card">
        <h2>Your data</h2>
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

      {error && !showUpgrade ? <p className="form-error">{error}</p> : null}

      <button className="btn btn-forest" type="button" onClick={() => void signOut()}>
        Log out
      </button>
      {deleteOpen ? (
        <ConfirmDialog
          title="Delete your account?"
          body="This removes your profile, checklist progress, notes, custom items, contacts, and devices. Purchase records and terms acceptances are kept as required. This cannot be undone."
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

function accessDescription(profile: { access_status?: string | null; access_interval?: string | null; access_renews_at?: string | null; plan?: string | null } | null) {
  if (!profile?.plan || profile.plan === "none") return "";
  if (profile.access_status === "grandfathered" || !profile.access_interval) {
    return "Existing Safety Prep List access is included with your account.";
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
  const { hasSurvivalVault, videos } = useApp();
  const published = videos.filter((v) => v.active && v.video_url);
  const categories = [...new Set(published.map((v) => v.category))];

  if (!hasSurvivalVault) {
    return (
      <div className="locked-panel">
        <p className="eyebrow">How-To Videos</p>
        <h2>Part of Survival Vault</h2>
        <p className="muted">
          How-To Videos come with Survival Vault. Watch the skills when you need them. Practical visual learning for water, power, off grid, food, communications, and home readiness. How-To Videos are a collection of external playlists we share.
        </p>
        <Link className="btn btn-primary" style={{ marginTop: 16 }} to="/app/account#addons">
          Add Survival Vault
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">
        <Link to="/app/survival">Survival Vault</Link>
      </p>
      <h1 className="page-title">How-To Videos</h1>
      {published.length === 0 && (
        <div className="status-banner">
          No videos yet. Add them in owner tools when they are ready.
        </div>
      )}
      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="section-title">{cat}</h2>
          {published
            .filter((v) => v.category === cat)
            .map((v) => (
              <article className="video-card" key={v.id}>
                {v.thumbnail_url && <img src={v.thumbnail_url} alt="" />}
                <h3 className="card-name">{v.title}</h3>
                <p className="muted">{v.description}</p>
                <p className="muted">{v.source_name}</p>
                {v.video_url && (
                  <a className="btn btn-forest" href={v.video_url} target="_blank" rel="noreferrer">
                    Watch
                  </a>
                )}
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}
