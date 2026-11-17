import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { parseSharePayload, type SharePayload } from "../lib/checklistShare";
import { isLicensed } from "../lib/licenseClient";
import { newLocalId, saveImportedList } from "../lib/localStore";

function decodePayloadParam(raw: string | null): SharePayload | null {
  if (!raw) return null;
  try {
    const json = decodeURIComponent(raw);
    return parseSharePayload(JSON.parse(json));
  } catch {
    try {
      const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
      return parseSharePayload(JSON.parse(json));
    } catch {
      return null;
    }
  }
}

export function ImportChecklistPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromQuery = useMemo(() => decodePayloadParam(params.get("import") || params.get("payload")), [params]);
  const [payload, setPayload] = useState<SharePayload | null>(fromQuery);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const sharedBy = payload?.sharedBy?.trim() || "Someone";

  async function onFile(e: FormEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      const parsed = parseSharePayload(JSON.parse(text));
      if (!parsed) throw new Error("That file is not a Safety Prep List share.");
      setPayload(parsed);
      setSavedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that share file.");
    }
  }

  async function saveCopy() {
    if (!payload) return;
    if (!isLicensed()) {
      navigate(`/activate?next=${encodeURIComponent("/import")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = newLocalId("import");
      await saveImportedList({
        id,
        title: payload.title,
        sharedBy: sharedBy === "Someone" ? "" : sharedBy,
        importedAt: new Date().toISOString(),
        items: payload.items.map((item) => ({
          id: newLocalId("impitem"),
          text: item.text,
          checked: Boolean(item.checked),
          note: item.note || "",
        })),
      });
      setSavedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your copy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="wrap auth-card" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 560 }}>
        <p className="eyebrow">Shared checklist</p>
        <h1>Open a shared list</h1>

        {!payload ? (
          <>
            <p className="muted">
              Paste a share link with a payload, or choose a checklist share file (.json). Your existing checklists stay as
              they are.
            </p>
            <label className="btn btn-ghost" style={{ display: "inline-block", marginTop: 16 }}>
              Choose share file
              <input type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e)} />
            </label>
          </>
        ) : (
          <>
            <p>
              {sharedBy} shared a checklist with you. Open it to save your own copy. Your existing checklist stays as it
              is.
            </p>
            <div className="panel" style={{ marginTop: 18 }}>
              <p className="eyebrow">Checklist</p>
              <h2 style={{ marginTop: 4 }}>{payload.title}</h2>
              <p className="muted">{payload.items.length} items</p>
            </div>
            {savedId ? (
              <>
                <p style={{ marginTop: 18 }}>Saved as your own copy. Nothing else was changed.</p>
                <Link className="btn btn-primary" to={`/app/imports/${savedId}`} style={{ marginTop: 12 }}>
                  View your copy
                </Link>
              </>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                style={{ marginTop: 18 }}
                disabled={busy}
                onClick={() => void saveCopy()}
              >
                {busy ? "Saving…" : isLicensed() ? "Save my own copy" : "Activate to save a copy"}
              </button>
            )}
          </>
        )}

        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}

        <p className="muted" style={{ marginTop: 28 }}>
          <Link to="/app/lists">Back to my lists</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
