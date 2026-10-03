import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { SAFETY_CATEGORY_LABELS, US_STATES, money } from "../lib/format";
import { COPY_KEY, DEFAULT_STEPS, VIDEO_CACHE_KEY, loadCopy, startOnboardingPreview, type TourCopy } from "../components/OnboardingTour";
import { AdminAccounts } from "../components/AdminAccounts";
import { DEFAULT_FAQS, HELP_FAQS_KEY, parseFaqs, type HelpFaq } from "../lib/help";
import { DEMO_PREVIEW_EMAIL, demoPreviewPassword } from "../lib/demo";

type AdminTab = "support" | "accounts" | "discounts" | "content" | "onboarding" | "faqs";
type DiscountKind = "percent" | "fixed";
type AppliesTo = "all" | "individual" | "family";
type Discount = {
  id: string;
  code: string;
  kind: DiscountKind;
  value: number;
  applies_to: AppliesTo;
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
};

export function AdminPage() {
  const { profile, catalog, safety, refreshAccount, signOut } = useApp();
  const [tab, setTab] = useState<AdminTab>("accounts");
  const [message, setMessage] = useState("");

  if (profile && profile.role !== "owner") return <Navigate to="/app" replace />;
  if (!profile) return <p className="wrap" style={{ padding: 40 }}>Loading owner console…</p>;

  return (
    <div className="admin-workspace">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="page-title">Operations</h1>
          <p className="muted admin-lead">Live accounts, checkout codes, support chats, and content — nothing here is sample data.</p>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-forest" type="button" onClick={() => window.open("https://dashboard.tawk.to", "_blank", "noopener,noreferrer")}>
            Open Tawk.to <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
      <AdminNotificationPrompt />
      <div className="admin-layout">
        <aside className="admin-rail" aria-label="Admin sections">
          <p className="admin-rail-label">Workspace</p>
          <AdminNavButton active={tab === "accounts"} label="Accounts & access" onClick={() => setTab("accounts")} />
          <AdminNavButton active={tab === "discounts"} label="Discount codes" onClick={() => setTab("discounts")} />
          <AdminNavButton active={tab === "support"} label="Support chats" onClick={() => setTab("support")} />
          <p className="admin-rail-label admin-rail-label-spaced">Manage content</p>
          <AdminNavButton active={tab === "content"} label="Checklist & resources" onClick={() => setTab("content")} />
          <AdminNavButton active={tab === "onboarding"} label="Onboarding" onClick={() => setTab("onboarding")} />
          <AdminNavButton active={tab === "faqs"} label="FAQs" onClick={() => setTab("faqs")} />
          <AdminNavButton active={false} label="Log out" onClick={() => void signOut()} />
        </aside>
        <section className="admin-content">
          {message && (
            <div className="admin-toast" role="status">
              <span>✓</span>{message}
              <button type="button" onClick={() => setMessage("")} aria-label="Dismiss">×</button>
            </div>
          )}
          {tab === "accounts" && <AdminAccounts />}
          {tab === "discounts" && <DiscountManager onSaved={setMessage} />}
          {tab === "support" && <SupportActivity />}
          {tab === "content" && <ContentTools catalog={catalog} safety={safety} refreshAccount={refreshAccount} onSaved={setMessage} />}
          {tab === "onboarding" && <OnboardingSettings onSaved={setMessage} />}
          {tab === "faqs" && <FaqSettings onSaved={setMessage} />}
        </section>
      </div>
    </div>
  );
}

function AdminNavButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`admin-nav-button ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span>{label}</span>
    </button>
  );
}

function AdminNotificationPrompt() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : "denied");
  if (!supported || permission === "granted") return null;
  async function enable() { setPermission(await Notification.requestPermission()); }
  return (
    <aside className="notification-prompt" role="status">
      <span><b>Turn notifications on</b><small>Get a browser alert when a support chat is waiting for you.</small></span>
      <button className="btn btn-forest" type="button" onClick={() => void enable()}>Turn on</button>
    </aside>
  );
}

type ActiveSupportChat = {
  chat_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_city: string | null;
  visitor_country: string | null;
  domain: string | null;
  referrer: string | null;
  first_message: string | null;
  started_at: string;
};

function SupportActivity() {
  const [chats, setChats] = useState<ActiveSupportChat[]>([]);
  const [configured, setConfigured] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("active_support_chats").select("*").order("started_at", { ascending: false });
      if (cancelled) return;
      if (error) { setConfigured(false); return; }
      setChats((data as ActiveSupportChat[]) || []);
    }
    void load();
    const channel = supabase.channel("owner-active-support-chats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "active_support_chats" }, (payload) => {
        const next = payload.new as ActiveSupportChat;
        setChats((current) => [next, ...current.filter((chat) => chat.chat_id !== next.chat_id)]);
        if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
          new Notification("New Safety Prep List chat", { body: `${next.visitor_name || "A visitor"} is waiting in Tawk.to.` });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "active_support_chats" }, (payload) => {
        const next = payload.new as ActiveSupportChat;
        setChats((current) => current.map((chat) => chat.chat_id === next.chat_id ? next : chat));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "active_support_chats" }, (payload) => {
        const old = payload.old as ActiveSupportChat;
        setChats((current) => current.filter((chat) => chat.chat_id !== old.chat_id));
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, []);
  return (
    <>
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Tawk.to</p>
          <h2>Support chats</h2>
          <p className="muted">Live visitors waiting in chat. Open Tawk.to to reply.</p>
        </div>
      </div>
      <section className={`admin-support-alert ${chats.length ? "has-chats" : ""}`} role="status">
        <span className="support-pulse"><i /></span>
        <div className="support-alert-copy">
          <b>{chats.length ? `${chats.length} chat${chats.length === 1 ? "" : "s"} waiting` : configured ? "No active chats right now" : "Support alerts need Supabase setup"}</b>
          <small>
            {chats.length
              ? `${chats[0].visitor_name || "A website visitor"} is waiting in Tawk.to.`
              : configured
                ? "This card lights up when a visitor starts a chat."
                : "Run the active-chat migration and deploy the Tawk webhook function."}
          </small>
        </div>
        <button className="btn btn-forest" type="button" onClick={() => window.open("https://dashboard.tawk.to", "_blank", "noopener,noreferrer")}>Open Tawk.to ↗</button>
      </section>
      {chats.length ? (
        <section className="admin-panel admin-table-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Visitor</th><th>Location</th><th>Started</th></tr></thead>
              <tbody>
                {chats.map((chat) => (
                  <tr key={chat.chat_id}>
                    <td><b>{chat.visitor_name || "Website visitor"}</b><small>{chat.visitor_email || chat.domain || "—"}</small></td>
                    <td>{[chat.visitor_city, chat.visitor_country].filter(Boolean).join(", ") || "—"}</td>
                    <td>{chat.started_at ? new Date(chat.started_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
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
          <p className="muted">These codes are checked on the server before PayPal charges. They apply to the subscription, not Survival Vault.</p>
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
                      <b>{row.kind === "percent" ? `${row.value}% off` : `${money(row.value)} off`}</b>
                      <small>Subscription only</small>
                    </td>
                    <td>{row.applies_to === "all" ? "All plans" : row.applies_to === "family" ? "Family" : "Individual"}</td>
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

function DiscountForm({ onClose, onSaved }: { onClose: () => void; onSaved: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [value, setValue] = useState("10");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("all");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      active: true,
      expires_at: expires ? new Date(expires).toISOString() : null,
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
        <p className="muted">PayPal will charge the discounted subscription amount. Survival Vault stays full price.</p>
        <label className="field"><span>Code</span><input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="READY15" /></label>
        <div className="admin-form-grid">
          <label className="field">
            <span>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as DiscountKind)}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed dollars off</option>
            </select>
          </label>
          <label className="field">
            <span>{kind === "percent" ? "Percent" : "Dollars"}</span>
            <input required type="number" min="1" step={kind === "percent" ? "1" : "0.01"} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Applies to</span>
          <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as AppliesTo)}>
            <option value="all">All plans</option>
            <option value="individual">Individual only</option>
            <option value="family">Family only</option>
          </select>
        </label>
        <label className="field"><span>Expires (optional)</span><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
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
  const [subtab, setSubtab] = useState<"items" | "videos" | "safety">("items");
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
        <button className={`btn ${subtab === "videos" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setSubtab("videos")}>How-To Videos</button>
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
      {subtab === "videos" && <VideoForm onSaved={onSaved} />}
      {subtab === "safety" && <SafetyForm onSaved={onSaved} existing={safety.length} />}
    </>
  );
}

function VideoForm({ onSaved }: { onSaved: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [video_url, setUrl] = useState("");
  const [category, setCategory] = useState("Home Readiness");
  const [source_name, setSource] = useState("Safety Prep List");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("video_resources").insert({ title, description, video_url, category, source_name, active: Boolean(video_url), sort_order: 90 });
    onSaved(error ? error.message : "Video saved.");
  }
  return (
    <form onSubmit={submit} className="panel admin-form-panel">
      <label className="field"><span>Title</span><input required value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="field"><span>Video URL</span><input value={video_url} onChange={(e) => setUrl(e.target.value)} /></label>
      <label className="field"><span>Category</span><input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
      <label className="field"><span>Source</span><input value={source_name} onChange={(e) => setSource(e.target.value)} /></label>
      <button className="btn btn-primary" type="submit">Add video</button>
    </form>
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
  const [videoUrl, setVideoUrl] = useState(() => localStorage.getItem(VIDEO_CACHE_KEY) || "");
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
          placeholder="YouTube, Vimeo, or direct .mp4 URL"
        />
        <small className="muted">Plays on the first-visit popup. Leave blank to hide the video.</small>
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

function FaqSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const [faqs, setFaqs] = useState<HelpFaq[]>(DEFAULT_FAQS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.from("app_config").select("value").eq("key", HELP_FAQS_KEY).maybeSingle().then(({ data }) => {
      const next = parseFaqs(data?.value);
      if (next.length) setFaqs(next);
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
