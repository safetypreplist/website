import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { SAFETY_CATEGORY_LABELS, US_STATES, money } from "../lib/format";
import { COPY_KEY, DEFAULT_STEPS, DEFAULT_VIDEO_URL, VIDEO_CACHE_KEY, loadCopy, startOnboardingPreview, type TourCopy } from "../components/OnboardingTour";
import { AdminAccounts } from "../components/AdminAccounts";
import { AdminRefunds } from "../components/AdminRefunds";
import { usePendingRefunds } from "../lib/refunds";
import { DEFAULT_FAQS, HELP_FAQS_KEY, parseFaqs, withNewDefaults, type HelpFaq } from "../lib/help";
import { DEMO_PREVIEW_EMAIL, demoPreviewPassword } from "../lib/demo";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  COMING_SOON_KEY,
  COMING_SOON_MAX_EYEBROW,
  COMING_SOON_MAX_MESSAGE,
  COMING_SOON_MAX_TITLE,
  DEFAULT_COMING_SOON_EYEBROW,
  DEFAULT_COMING_SOON_MESSAGE,
  DEFAULT_COMING_SOON_TITLE,
  announceComingSoonChange,
  parseComingSoon,
} from "../lib/comingSoon";

type AdminTab = "accounts" | "refunds" | "discounts" | "content" | "onboarding" | "faqs" | "comingSoon" | "analytics";
type DiscountKind = "percent" | "fixed" | "price";
type AppliesTo = "all" | "individual" | "family";
type AppliesToInterval = "all" | "monthly" | "annual";
type Discount = {
  id: string;
  code: string;
  kind: DiscountKind;
  value: number;
  applies_to: AppliesTo;
  applies_to_interval?: AppliesToInterval | null;
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  discount_payments?: number | null;
};

export function AdminPage() {
  const { profile, catalog, safety, refreshAccount, signOut } = useApp();
  const [tab, setTab] = useState<AdminTab>("accounts");
  const [message, setMessage] = useState("");
  const [pendingRefunds, setPendingRefunds] = usePendingRefunds(profile?.role === "owner");

  if (profile && profile.role !== "owner") return <Navigate to="/app" replace />;
  if (!profile) return <p className="wrap" style={{ padding: 40 }}>Loading owner console…</p>;

  return (
    <div className="admin-workspace">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="page-title">Operations</h1>
          <p className="muted admin-lead">Live accounts, checkout codes, and content — nothing here is sample data.</p>
        </div>
      </div>
      <div className="admin-layout">
        <aside className="admin-rail" aria-label="Admin sections">
          <p className="admin-rail-label">Workspace</p>
          <AdminNavButton active={tab === "accounts"} label="Accounts & access" onClick={() => setTab("accounts")} />
          <AdminNavButton active={tab === "refunds"} label="Refund requests" badge={pendingRefunds} onClick={() => setTab("refunds")} />
          <AdminNavButton active={tab === "discounts"} label="Discount codes" onClick={() => setTab("discounts")} />
          <p className="admin-rail-label admin-rail-label-spaced">Manage content</p>
          <AdminNavButton active={tab === "content"} label="Checklist & resources" onClick={() => setTab("content")} />
          <AdminNavButton active={tab === "onboarding"} label="Onboarding" onClick={() => setTab("onboarding")} />
          <AdminNavButton active={tab === "faqs"} label="FAQs" onClick={() => setTab("faqs")} />
          <p className="admin-rail-label admin-rail-label-spaced">Site</p>
          <AdminNavButton active={tab === "analytics"} label="Analytics" onClick={() => setTab("analytics")} />
          <AdminNavButton active={tab === "comingSoon"} label="Maintenance Mode" onClick={() => setTab("comingSoon")} />
          <AdminNavButton active={false} label="Log out" onClick={() => void signOut()} />
        </aside>
        <section className="admin-content">
          {message && (
            <div className="admin-toast" role="status">
              <span>✓</span>{message}
              <button type="button" onClick={() => setMessage("")} aria-label="Dismiss">×</button>
            </div>
          )}
          {pendingRefunds > 0 && tab !== "refunds" ? (
            <button className="admin-refund-alert" type="button" onClick={() => setTab("refunds")}>
              <b>{pendingRefunds}</b>
              {pendingRefunds === 1 ? "refund request is" : "refund requests are"} waiting for you. Review now →
            </button>
          ) : null}
          {tab === "accounts" && <AdminAccounts />}
          {tab === "refunds" && <AdminRefunds onPendingChange={setPendingRefunds} />}
          {tab === "discounts" && <DiscountManager onSaved={setMessage} />}
          {tab === "content" && <ContentTools catalog={catalog} safety={safety} refreshAccount={refreshAccount} onSaved={setMessage} />}
          {tab === "onboarding" && <OnboardingSettings onSaved={setMessage} />}
          {tab === "faqs" && <FaqSettings onSaved={setMessage} />}
          {tab === "analytics" && <AnalyticsDesk />}
          {tab === "comingSoon" && <ComingSoonSettings onSaved={setMessage} />}
        </section>
      </div>
    </div>
  );
}

function AdminNavButton({ active, label, badge = 0, onClick }: { active: boolean; label: string; badge?: number; onClick: () => void }) {
  return (
    <button className={`admin-nav-button ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span>{label}</span>
      {badge > 0 ? (
        <b className="alert" aria-label={`${badge} waiting`}>
          {badge}
        </b>
      ) : null}
    </button>
  );
}

function AnalyticsDesk() {
  return (
    <div className="admin-panel analytics-desk">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Site</p>
          <h2>Analytics</h2>
        </div>
      </div>
      <p className="muted">
        You do not put hot spots on the pages. After people visit the live site, Contentsquare draws them from the clicks it recorded. Google Analytics shows where those visits came from and which devices they used.
      </p>
      <div className="analytics-desk-grid">
        <article>
          <h3>Google Analytics</h3>
          <p>Traffic sources, devices, and whether anyone reached checkout or a purchase.</p>
          <a className="btn btn-forest" href="https://analytics.google.com/" target="_blank" rel="noreferrer">Open Google Analytics</a>
        </article>
        <article>
          <h3>Contentsquare</h3>
          <p>Heatmaps and recordings of the public pages. Open a page, then look at Zoning or Heatmaps.</p>
          <a className="btn btn-forest" href="https://app.contentsquare.com/" target="_blank" rel="noreferrer">Open Contentsquare</a>
        </article>
      </div>
      <p className="muted">
        The free plans keep the charts in those two sites. They do not offer a key that can pull the live charts into this console. Sign-in, account, and the thank-you page are left out of session recordings.
      </p>
    </div>
  );
}

function DiscountManager({ onSaved }: { onSaved: (message: string) => void }) {
  const [rows, setRows] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    setRows((data as Discount[]) || []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function toggle(row: Discount) {
    const { error: saveError } = await supabase.from("discount_codes").update({ active: !row.active, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (saveError) { setError(saveError.message); return; }
    onSaved(`${row.code} is now ${row.active ? "off" : "on"} at checkout.`);
    await load();
  }

  return (
    <>
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Checkout</p>
          <h2>Discount codes</h2>
          <p className="muted">These codes are checked on the server before Stripe charges. They apply to the subscription, not Survival Vault.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>+ Create code</button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="admin-panel admin-table-panel">
        {loading ? <p className="muted" style={{ padding: 20 }}>Loading codes…</p> : rows.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table discount-table">
              <thead><tr><th>Code</th><th>Offer</th><th>Applies to</th><th>Used</th><th>Expires</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><code className="discount-code">{row.code}</code></td>
                    <td>
                      <b>{discountOfferLabel(row)}</b>
                      <small>{discountDurationLabel(row.discount_payments)}{row.kind === "price" ? ", per checklist" : ""}</small>
                    </td>
                    <td>
                      {row.applies_to === "all" ? "All plans" : row.applies_to === "family" ? "Family" : "Individual"}
                      <small>{intervalLabel(row.applies_to_interval)}</small>
                    </td>
                    <td>{row.redemption_count}{row.max_redemptions ? ` / ${row.max_redemptions}` : ""}</td>
                    <td>{row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "No end date"}</td>
                    <td><span className={`status-pill ${row.active ? "active" : "deactivated"}`}>{row.active ? "Active" : "Off"}</span></td>
                    <td>
                      <button className="table-action-button" type="button" onClick={() => void toggle(row)}>
                        {row.active ? "Turn off" : "Turn on"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ padding: 20 }}>No codes yet.</p>}
      </section>
      {showForm ? (
        <DiscountForm
          onClose={() => setShowForm(false)}
          onSaved={async (code) => {
            setShowForm(false);
            onSaved(`${code} is live at checkout.`);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function discountOfferLabel(row: Pick<Discount, "kind" | "value">) {
  if (row.kind === "percent") return `${row.value}% off`;
  if (row.kind === "price") return `Set price ${money(row.value)}`;
  return `${money(row.value)} off`;
}

function intervalLabel(interval?: AppliesToInterval | null) {
  if (interval === "monthly") return "Monthly billing only";
  if (interval === "annual") return "Annual billing only";
  return "Monthly or Annual";
}

function discountDurationLabel(payments?: number | null) {
  const count = Math.max(1, payments || 1);
  return count === 1 ? "First payment only" : `First ${count} payments`;
}

function DiscountForm({ onClose, onSaved }: { onClose: () => void; onSaved: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [value, setValue] = useState("10");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("all");
  const [billing, setBilling] = useState<AppliesToInterval>("all");
  const [expires, setExpires] = useState("");
  const [payments, setPayments] = useState("1");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const paymentCount = Math.max(1, Math.round(Number(payments)) || 1);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) { setError("Enter a code using letters and numbers."); return; }
    const numeric = Number(value);
    const storedValue = kind === "percent" ? Math.round(numeric) : Math.round(numeric * 100);
    if (!storedValue || storedValue <= 0 || (kind === "percent" && storedValue > 100)) {
      setError(kind === "percent" ? "Percent must be between 1 and 100." : "Enter a dollar amount greater than 0.");
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase.from("discount_codes").insert({
      code: normalized,
      kind,
      value: storedValue,
      applies_to: appliesTo,
      applies_to_interval: billing,
      active: true,
      expires_at: expires ? new Date(expires).toISOString() : null,
      discount_payments: paymentCount,
    });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    await onSaved(normalized);
  }

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-modal" onSubmit={(event) => void submit(event)}>
        <button className="drawer-close" type="button" onClick={onClose}>×</button>
        <p className="eyebrow">New checkout offer</p>
        <h2>Create a discount code</h2>
        <p className="muted">Stripe will charge the discounted subscription amount. Survival Vault stays full price.</p>
        <label className="field"><span>Code</span><input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="READY15" /></label>
        <div className="admin-form-grid">
          <label className="field">
            <span>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as DiscountKind)}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed dollars off</option>
              <option value="price">Set price</option>
            </select>
          </label>
          <label className="field">
            <span>{kind === "percent" ? "Percent" : kind === "price" ? "Price per checklist ($)" : "Dollars"}</span>
            <input required type="number" min={kind === "percent" ? "1" : "0.01"} step={kind === "percent" ? "1" : "0.01"} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        </div>
        {kind === "price" ? (
          <p className="muted">Each discounted payment becomes this price for each checklist. A 2-person Family plan pays twice this amount.</p>
        ) : null}
        <div className="admin-form-grid">
          <label className="field">
            <span>Applies to</span>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as AppliesTo)}>
              <option value="all">All plans</option>
              <option value="individual">Individual only</option>
              <option value="family">Family only</option>
            </select>
          </label>
          <label className="field">
            <span>Billing</span>
            <select value={billing} onChange={(e) => setBilling(e.target.value as AppliesToInterval)}>
              <option value="all">Monthly or Annual</option>
              <option value="monthly">Monthly only</option>
              <option value="annual">Annual only</option>
            </select>
          </label>
        </div>
        <div className="admin-form-grid">
          <label className="field">
            <span>Discounted payments</span>
            <input required type="number" min="1" step="1" value={payments} onChange={(e) => setPayments(e.target.value)} />
          </label>
          <label className="field"><span>Code expires (optional)</span><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        </div>
        <p className="muted">
          {paymentCount === 1
            ? "Only the first payment is discounted. Renewals are at the regular price."
            : `The first ${paymentCount} payments are discounted (${paymentCount} months on Monthly, ${paymentCount} years on Annual), then the regular price.`}{" "}
          The expiration date only stops new customers from using the code.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="drawer-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Create code"}</button>
        </div>
      </form>
    </div>
  );
}

function ContentTools({ catalog, safety, refreshAccount, onSaved }: {
  catalog: { items: Array<{ id: string; permanent_key: string; text: string; description?: string | null }>; };
  safety: Array<unknown>;
  refreshAccount: () => Promise<void>;
  onSaved: (message: string) => void;
}) {
  const [subtab, setSubtab] = useState<"items" | "safety">("items");
  return (
    <>
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Content</p>
          <h2>Checklist & resources</h2>
          <p className="muted">Edit live wording and info tips. Leave a tip blank to hide the “i” on that item.</p>
        </div>
      </div>
      <div className="toolbar admin-content-tabs">
        <button className={`btn ${subtab === "items" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setSubtab("items")}>Checklist items</button>
        <button className={`btn ${subtab === "safety" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setSubtab("safety")}>Safety directory</button>
      </div>
      {subtab === "items" && (
        <div className="admin-panel admin-content-panel">
          {catalog.items.map((item) => (
            <div className="admin-item-edit" key={item.id}>
              <label className="field">
                <span>{item.permanent_key}</span>
                <input
                  defaultValue={item.text}
                  onBlur={async (e) => {
                    await supabase.from("checklist_items").update({ text: e.target.value }).eq("id", item.id);
                    onSaved("Item wording saved.");
                    await refreshAccount();
                  }}
                />
              </label>
              <label className="field">
                <span>Info tip</span>
                <textarea
                  rows={2}
                  defaultValue={item.description || ""}
                  placeholder="Shown on the i icon. Leave empty for no tip."
                  onBlur={async (e) => {
                    await supabase.from("checklist_items").update({ description: e.target.value.trim() || null }).eq("id", item.id);
                    onSaved("Info tip saved.");
                    await refreshAccount();
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      )}
      {subtab === "safety" && <SafetyForm onSaved={onSaved} existing={safety.length} />}
    </>
  );
}

function SafetyForm({ onSaved, existing }: { onSaved: (s: string) => void; existing: number }) {
  const [agency_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [source_url, setSource] = useState("");
  const [state, setState] = useState("");
  const [category, setCategory] = useState("utilities");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("safety_contacts").insert({
      agency_name,
      phone: phone || null,
      website: website || null,
      source_url: source_url || null,
      state: state || null,
      category,
      verified_at: new Date().toISOString().slice(0, 10),
      active: true,
    });
    onSaved(error ? error.message : `Saved. Directory now starts from ${existing + 1} records.`);
  }
  return (
    <form onSubmit={submit} className="panel admin-form-panel">
      <label className="field"><span>Agency</span><input required value={agency_name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(SAFETY_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="field"><span>State</span><select value={state} onChange={(e) => setState(e.target.value)}><option value="">National</option>{US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
      <label className="field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="field"><span>Website</span><input value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      <label className="field"><span>Source URL</span><input value={source_url} onChange={(e) => setSource(e.target.value)} /></label>
      <button className="btn btn-primary" type="submit">Add resource</button>
    </form>
  );
}

function OnboardingSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const navigate = useNavigate();
  const { signIn } = useApp();
  const [copy, setCopy] = useState<TourCopy>(() => loadCopy());
  const [videoUrl, setVideoUrl] = useState(() => localStorage.getItem(VIDEO_CACHE_KEY) ?? DEFAULT_VIDEO_URL);
  const [loading, setLoading] = useState(true);
  const update = (index: number, field: "title" | "body", value: string) =>
    setCopy((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));

  useEffect(() => {
    void supabase.from("app_config").select("key, value").in("key", ["onboarding_copy", "onboarding_video_url"]).then(({ data }) => {
      for (const row of data || []) {
        if (row.key === "onboarding_copy" && Array.isArray(row.value) && row.value.length) {
          setCopy(row.value as TourCopy);
        }
        if (row.key === "onboarding_video_url") {
          const value = row.value;
          setVideoUrl(typeof value === "string" ? value : typeof value?.url === "string" ? value.url : "");
        }
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    const now = new Date().toISOString();
    const { error } = await supabase.from("app_config").upsert([
      { key: "onboarding_copy", value: copy, updated_at: now },
      { key: "onboarding_video_url", value: videoUrl.trim(), updated_at: now },
    ]);
    if (error) { onSaved(error.message); return; }
    localStorage.setItem(COPY_KEY, JSON.stringify(copy));
    localStorage.setItem(VIDEO_CACHE_KEY, videoUrl.trim());
    onSaved("Onboarding tour and welcome video are saved for every customer.");
  }

  function reset() {
    setCopy(DEFAULT_STEPS.map(({ title, body }) => ({ title, body })));
  }

  if (loading) return <p className="muted">Loading onboarding copy…</p>;
  return (
    <div className="admin-form-panel admin-onboarding-settings">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Owner controls</p>
          <h2>Onboarding</h2>
          <p className="muted">Customers with a plan see this once. Preview it here, then edit the welcome video and tour stops.</p>
        </div>
        <button
          className="btn btn-forest"
          type="button"
          onClick={() => {
            void (async () => {
              startOnboardingPreview();
              const password = demoPreviewPassword();
              if (password) {
                try {
                  await signIn(DEMO_PREVIEW_EMAIL, password);
                } catch {
                  /* preview still opens on the current session if demo login is unavailable */
                }
              }
              navigate("/app");
            })();
          }}
        >
          Preview onboarding
        </button>
      </div>
      <label className="account-field admin-onboarding-video-field">
        <span>Welcome popup video</span>
        <input
          value={videoUrl}
          onChange={(event) => setVideoUrl(event.target.value)}
          placeholder="/videos/welcome.mp4 or a direct .mp4 URL"
        />
        <small className="muted">
          Plays on the first-visit popup. A direct .mp4 plays with no outside logos or titles; YouTube and Vimeo links
          still show their own branding. Leave blank to hide the video.
        </small>
      </label>
      {copy.map((item, index) => (
        <fieldset className="admin-onboarding-step" key={index}>
          <legend>Tour stop {index + 1}</legend>
          <label className="account-field"><span>Title</span><input value={item.title} onChange={(event) => update(index, "title", event.target.value)} /></label>
          <label className="account-field"><span>Description</span><textarea rows={3} value={item.body} onChange={(event) => update(index, "body", event.target.value)} /></label>
        </fieldset>
      ))}
      <div className="drawer-actions">
        <button className="btn btn-ghost" type="button" onClick={reset}>Reset tour defaults</button>
        <button className="btn btn-primary" type="button" onClick={() => void save()}>Save onboarding</button>
      </div>
    </div>
  );
}

function ComingSoonSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [savedEnabled, setSavedEnabled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [eyebrow, setEyebrow] = useState(DEFAULT_COMING_SOON_EYEBROW);
  const [title, setTitle] = useState(DEFAULT_COMING_SOON_TITLE);
  const [message, setMessage] = useState(DEFAULT_COMING_SOON_MESSAGE);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function show(setting: ReturnType<typeof parseComingSoon>) {
    setEyebrow(setting.eyebrow);
    setTitle(setting.title);
    setMessage(setting.message);
  }

  useEffect(() => {
    void supabase.from("app_config").select("value").eq("key", COMING_SOON_KEY).maybeSingle().then(({ data }) => {
      const setting = parseComingSoon(data?.value);
      setSavedEnabled(setting.enabled);
      setEnabled(setting.enabled);
      show(setting);
      setLoading(false);
    });
  }, []);

  async function save() {
    setConfirmOpen(false);
    setSaving(true);
    setError("");
    const setting = parseComingSoon({ enabled, eyebrow, title, message });
    const { error: saveError } = await supabase.from("app_config").upsert({
      key: COMING_SOON_KEY,
      value: setting,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setSavedEnabled(setting.enabled);
    show(setting);
    announceComingSoonChange();
    onSaved(
      setting.enabled
        ? "Maintenance Mode is on. Public visitors now see the maintenance page."
        : "Maintenance Mode is off. The site is open to everyone.",
    );
  }

  if (loading) return <p className="muted">Loading Maintenance Mode settings…</p>;

  const previewTitle = title.trim() || DEFAULT_COMING_SOON_TITLE;
  const previewMessage = message.trim() || DEFAULT_COMING_SOON_MESSAGE;

  return (
    <div className="admin-form-panel">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Owner controls</p>
          <h2>Maintenance Mode</h2>
          <p className="muted">
            Hides the public site behind a branded page. You and anyone already signed in can still use the app, and
            the sign-in page stays open.
          </p>
        </div>
        <span className={`coming-soon-status ${savedEnabled ? "on" : "off"}`} role="status">
          {savedEnabled ? "On" : "Off"}
        </span>
      </div>
      <div className="coming-soon-toggle">
        <button
          className="switch"
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Maintenance Mode"
          onClick={() => setEnabled((value) => !value)}
        >
          <span className="switch-knob" />
        </button>
        <div>
          <b>{enabled ? "Maintenance Mode on" : "Maintenance Mode off"}</b>
          <span>
            {enabled
              ? "Public visitors see the maintenance page. New purchases are blocked for people who aren't customers yet."
              : "The website is open to everyone."}
          </span>
        </div>
      </div>
      <label className="account-field">
        <span>Small label above the title</span>
        <input
          value={eyebrow}
          maxLength={COMING_SOON_MAX_EYEBROW}
          onChange={(event) => setEyebrow(event.target.value)}
          placeholder={DEFAULT_COMING_SOON_EYEBROW}
        />
        <small className="muted">Leave it empty to show no label.</small>
      </label>
      <label className="account-field">
        <span>Title</span>
        <input
          value={title}
          maxLength={COMING_SOON_MAX_TITLE}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={DEFAULT_COMING_SOON_TITLE}
        />
        <small className="muted">Leave it empty to use “{DEFAULT_COMING_SOON_TITLE}”.</small>
      </label>
      <label className="account-field">
        <span>Message</span>
        <textarea
          rows={4}
          maxLength={COMING_SOON_MAX_MESSAGE}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <small className="muted">
          {message.length}/{COMING_SOON_MAX_MESSAGE}. Leave it empty to use the default message.
        </small>
      </label>
      <p className="eyebrow maintenance-preview-label">Preview</p>
      <div className="maintenance-preview" aria-label="Preview of the maintenance page">
        {eyebrow.trim() ? <p className="eyebrow">{eyebrow.trim()}</p> : null}
        <h3>{previewTitle}</h3>
        <p>{previewMessage}</p>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="drawer-actions">
        <a className="btn btn-ghost" href="/maintenance" target="_blank" rel="noopener noreferrer">
          Open full page
        </a>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            setEyebrow(DEFAULT_COMING_SOON_EYEBROW);
            setTitle(DEFAULT_COMING_SOON_TITLE);
            setMessage(DEFAULT_COMING_SOON_MESSAGE);
          }}
        >
          Reset text to default
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={saving}
          onClick={() => (enabled && !savedEnabled ? setConfirmOpen(true) : void save())}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {confirmOpen ? (
        <ConfirmDialog
          title="Turn on Maintenance Mode?"
          body="Public visitors will no longer see the website, and new purchases will be blocked for people who aren't customers yet. You and anyone already signed in can keep using the app."
          confirmLabel="Turn on"
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void save()}
        />
      ) : null}
    </div>
  );
}

function FaqSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const [faqs, setFaqs] = useState<HelpFaq[]>(DEFAULT_FAQS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.from("app_config").select("value").eq("key", HELP_FAQS_KEY).maybeSingle().then(({ data }) => {
      setFaqs(withNewDefaults(parseFaqs(data?.value)));
      setLoading(false);
    });
  }, []);

  function update(index: number, field: "question" | "answer", value: string) {
    setFaqs((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function addFaq() {
    setFaqs((current) => [...current, { id: `faq-${Date.now()}`, question: "", answer: "" }]);
  }

  function removeFaq(index: number) {
    setFaqs((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function save() {
    const cleaned = faqs
      .map((item, index) => ({
        id: item.id || `faq-${index}`,
        question: item.question.trim(),
        answer: item.answer.trim(),
        ...(item.linkTo && item.linkLabel ? { linkTo: item.linkTo, linkLabel: item.linkLabel } : {}),
      }))
      .filter((item) => item.question && item.answer);
    const { error } = await supabase.from("app_config").upsert({
      key: HELP_FAQS_KEY,
      value: cleaned,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      onSaved(error.message);
      return;
    }
    setFaqs(cleaned);
    onSaved("FAQs are saved for the Help page.");
  }

  if (loading) return <p className="muted">Loading FAQs…</p>;

  return (
    <div className="admin-form-panel">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Owner controls</p>
          <h2>FAQs</h2>
          <p className="muted">These answers show on the in-app Help page. Add, edit, or remove them anytime.</p>
        </div>
        <button className="btn btn-forest" type="button" onClick={addFaq}>
          Add FAQ
        </button>
      </div>
      {faqs.length === 0 ? <p className="muted">No FAQs yet. Add one to get started.</p> : null}
      {faqs.map((faq, index) => (
        <fieldset className="admin-onboarding-step" key={faq.id}>
          <legend>Question {index + 1}</legend>
          <label className="account-field">
            <span>Question</span>
            <input value={faq.question} onChange={(event) => update(index, "question", event.target.value)} />
          </label>
          <label className="account-field">
            <span>Answer</span>
            <textarea rows={3} value={faq.answer} onChange={(event) => update(index, "answer", event.target.value)} />
          </label>
          <button className="btn btn-ghost" type="button" onClick={() => removeFaq(index)}>
            Remove
          </button>
        </fieldset>
      ))}
      <div className="drawer-actions">
        <button className="btn btn-ghost" type="button" onClick={() => setFaqs(DEFAULT_FAQS)}>
          Reset defaults
        </button>
        <button className="btn btn-primary" type="button" onClick={() => void save()}>
          Save FAQs
        </button>
      </div>
    </div>
  );
}
