import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PayPalCheckout } from "../components/PayPalCheckout";
import { useApp } from "../context/AppContext";
import { money, formatDate } from "../lib/format";
import { checklistTitle, initialsFrom, planTypeLabel } from "../lib/identity";

export function AccountPage() {
  const {
    profile,
    products,
    signOut,
    refreshAccount,
    user,
    devices,
    updateProfile,
    uploadAvatar,
    myChecklist,
    familyMembers,
    hasSurvivalVault,
  } = useApp();
  const location = useLocation();
  const upgrade = products.find((p) => p.slug === "upgrade_full");
  const fileRef = useRef<HTMLInputElement>(null);
  const [first, setFirst] = useState(profile?.first_name || "");
  const [last, setLast] = useState(profile?.last_name || "");
  const [display, setDisplay] = useState(profile?.display_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [copied, setCopied] = useState(false);
  const used = devices.length;
  const familySize = familyMembers.filter((m) => m.status !== "cancelled").length || 1;
  const planName = planTypeLabel({ plan: profile?.plan, familySize });

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

  async function copyId() {
    if (!myChecklist?.publicId) return;
    await navigator.clipboard.writeText(myChecklist.publicId);
    setCopied(true);
  }

  return (
    <div className="account-page">
      <h1 className="page-title">Profile</h1>

      <article className="account-card">
        <div className="account-photo">
          <span className="account-photo-mark">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initialsFrom(display || first, user?.email)}</span>}
          </span>
          <div>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void onPhoto(e.target.files?.[0])}
            />
            <button className="btn btn-ghost" type="button" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              {photoBusy ? "Saving photo…" : profile?.avatar_url ? "Change photo" : "Upload photo"}
            </button>
          </div>
        </div>

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
        <div className="account-field">
          <span>Email</span>
          <p>{user?.email || profile?.email || "—"}</p>
        </div>
        <button className="btn btn-forest" type="button" disabled={saving} onClick={() => void saveDetails()}>
          {saving ? "Saving…" : "Save details"}
        </button>
        {saved ? <p className="account-saved">{saved}</p> : null}
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
            <p className="muted">
              Off-grid systems, water purification, backup battery and solar, emergency heating and cooling, long-term
              food, and How-To Videos. {upgrade ? money(upgrade.amount_cents, upgrade.currency) : "$10"} one time, not
              per person.
            </p>
            <button className="btn btn-primary" type="button" onClick={() => setShowUpgrade(true)}>
              Add Survival Vault
            </button>
            {showUpgrade && (
              <div style={{ marginTop: 16 }}>
                {error && <p className="form-error">{error}</p>}
                <PayPalCheckout
                  productSlug="upgrade_full"
                  onError={setError}
                  onCaptured={async () => {
                    await refreshAccount();
                    setShowUpgrade(false);
                  }}
                />
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

      {error && !showUpgrade ? <p className="form-error">{error}</p> : null}

      <button className="btn btn-forest" type="button" onClick={() => void signOut()}>
        Log out
      </button>
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
          How-To Videos come with Survival Vault: water, power, off-grid, food, and home readiness skills.
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
