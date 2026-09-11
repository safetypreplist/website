import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { SAFETY_CATEGORY_LABELS, US_STATES } from "../lib/format";

export function AdminPage() {
  const { profile, catalog, safety, refreshAccount } = useApp();
  const [tab, setTab] = useState<"items" | "videos" | "safety">("items");
  const [message, setMessage] = useState("");

  if (profile && profile.role !== "owner") return <Navigate to="/app" replace />;
  if (!profile) return null;

  return (
    <div>
      <h1 className="page-title">Owner tools</h1>
      <p className="muted">Lightweight editing. For bulk work, use the Supabase Table Editor. See docs/ADMIN.md.</p>
      <div className="toolbar">
        <button className={`btn ${tab === "items" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setTab("items")}>
          Checklist items
        </button>
        <button className={`btn ${tab === "videos" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setTab("videos")}>
          Video resources
        </button>
        <button className={`btn ${tab === "safety" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setTab("safety")}>
          Safety directory
        </button>
      </div>
      {message && <p className="status-banner">{message}</p>}

      {tab === "items" && (
        <div>
          {catalog.items.slice(0, 80).map((item) => (
            <label className="field" key={item.id}>
              <span>{item.permanent_key}</span>
              <input
                defaultValue={item.text}
                onBlur={async (e) => {
                  await supabase.from("checklist_items").update({ text: e.target.value }).eq("id", item.id);
                  setMessage("Item wording saved. Progress stays attached to the permanent key.");
                  await refreshAccount();
                }}
              />
            </label>
          ))}
          <p className="muted">Showing the first 80 items. Edit the rest in Supabase.</p>
        </div>
      )}

      {tab === "videos" && <VideoForm onSaved={setMessage} />}
      {tab === "safety" && <SafetyForm onSaved={setMessage} existing={safety.length} />}
    </div>
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
    const { error } = await supabase.from("video_resources").insert({
      title,
      description,
      video_url,
      category,
      source_name,
      active: Boolean(video_url),
      sort_order: 90,
    });
    onSaved(error ? error.message : "Video saved. Set active=true once the URL is final.");
  }

  return (
    <form onSubmit={submit} className="panel" style={{ padding: 16 }}>
      <label className="field"><span>Title</span><input required value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="field"><span>Video URL</span><input value={video_url} onChange={(e) => setUrl(e.target.value)} /></label>
      <label className="field"><span>Category</span><input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
      <label className="field"><span>Source</span><input value={source_name} onChange={(e) => setSource(e.target.value)} /></label>
      <button className="btn btn-primary" style={{ marginTop: 12 }} type="submit">Add video</button>
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
    onSaved(error ? error.message : `Saved. Directory now starts from ${existing + 1} records. Only add numbers you have verified.`);
  }

  return (
    <form onSubmit={submit} className="panel" style={{ padding: 16 }}>
      <label className="field"><span>Agency</span><input required value={agency_name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(SAFETY_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>State (blank = national)</span>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">National</option>
          {US_STATES.map(([c, n]) => (
            <option key={c} value={c}>{n}</option>
          ))}
        </select>
      </label>
      <label className="field"><span>Phone (verified only)</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="field"><span>Website</span><input value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      <label className="field"><span>Source URL</span><input value={source_url} onChange={(e) => setSource(e.target.value)} /></label>
      <button className="btn btn-primary" style={{ marginTop: 12 }} type="submit">Add resource</button>
    </form>
  );
}
