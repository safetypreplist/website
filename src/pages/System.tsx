import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useApp } from "../context/AppContext";
import {
  ITEM_LIMIT_ERROR,
  customCountInSection,
  customItemCap,
  itemsForSection,
} from "../lib/customItems";
import { formatDateTime } from "../lib/format";
import { SURVIVAL_VAULT_DESCRIPTION } from "../lib/pricing";

export function SystemPage() {
  const { slug } = useParams();
  const { catalog, progress, saveProgress, sync, customItems, addCustomItem, removeCustomItem, hasSurvivalVault, viewing } = useApp();
  const system = catalog.systems.find((s) => s.slug === slug);
  const sections = useMemo(
    () => catalog.sections.filter((s) => s.system_id === system?.id).sort((a, b) => a.sort_order - b.sort_order),
    [catalog.sections, system?.id],
  );
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addingTo, setAddingTo] = useState<{ id: string; title: string } | null>(null);
  const [removeItem, setRemoveItem] = useState<{ id: string; text: string } | null>(null);

  const lastSavedAt = useMemo(() => {
    const stamps = sections
      .flatMap((section) => itemsForSection(catalog.items, customItems, section.id))
      .map((item) => progress[item.id]?.updated_at)
      .filter((value): value is string => Boolean(value))
      .sort();
    return stamps.at(-1) ?? null;
  }, [catalog.items, customItems, progress, sections]);

  if (!system) return <p>System not found.</p>;
  if (system.access_tier === "full" && !hasSurvivalVault) {
    return (
      <div className="locked-panel">
        <p className="eyebrow">Survival Vault</p>
        <h2>Want to go beyond the basics?</h2>
        <p className="muted">{SURVIVAL_VAULT_DESCRIPTION}</p>
        <Link className="btn btn-primary" style={{ marginTop: 16 }} to="/app/account#addons">
          Add Survival Vault
        </Link>
      </div>
    );
  }

  return (
    <div className="list-page">
      <div className="print-header">
        <h1>Safety Prep List: {system.title}</h1>
        <p>Printed {new Date().toLocaleDateString()}</p>
      </div>
      <div className="print-actions">
        <Link className="btn btn-ghost" to="/app">Back</Link>
        <button className="btn btn-forest" type="button" onClick={() => window.print()}>
          Print this list
        </button>
      </div>
      <header className="list-hero">
        <div>
          {system.time_label ? <p className="time-label">{system.time_label}</p> : null}
          <h1>{system.title}</h1>
          {system.description ? <p className="list-lead">{system.description}</p> : null}
        </div>
        <p className={`list-saved ${sync === "waiting" ? "wait" : ""}`}>
          <b>
            {sync === "saving" ? "Saving…" : sync === "waiting" ? "Waiting to sync" : lastSavedAt ? "Saved" : ""}
          </b>
          {lastSavedAt ? <span>{formatDateTime(lastSavedAt)}</span> : null}
        </p>
      </header>

      {sections.map((section) => {
        const items = itemsForSection(catalog.items, customItems, section.id);
        const customIds = new Set(customItems.filter((item) => item.section_id === section.id).map((item) => item.id));
        return (
          <section className="list-group" key={section.id}>
            <header className="list-group-head">
              <div>
                <h3>{section.title}</h3>
                {section.intro ? <p>{section.intro}</p> : null}
              </div>
              {viewing.canEdit ? (
                <button
                  className="add-item-btn"
                  type="button"
                  aria-label={`Add item to ${section.title}`}
                  onClick={() => setAddingTo({ id: section.id, title: section.title })}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 6.5v11M6.5 12h11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
            </header>
            <div className="list-group-body">
              {items.map((item) => {
                const row = progress[item.id];
                const checked = Boolean(row?.checked);
                const note = row?.note || "";
                const noteOpen = openNote === item.id;
                const description = item.description?.trim();
                const isCustom = customIds.has(item.id);
                return (
                  <article className={`check-item${checked ? " is-done" : ""}${note || noteOpen ? " has-note" : ""}`} key={item.id}>
                    <div className="check-row">
                      <button
                        className={`check ${checked ? "on" : ""}`}
                        aria-pressed={checked}
                        aria-label={item.text}
                        type="button"
                        onClick={() => viewing.canEdit && void saveProgress(item.id, !checked, note)}
                        disabled={!viewing.canEdit}
                      >
                        {checked ? "✓" : ""}
                      </button>
                      <div className="check-main">
                        <button
                          className="check-copy"
                          type="button"
                          onClick={() => viewing.canEdit && void saveProgress(item.id, !checked, note)}
                        disabled={!viewing.canEdit}
                        >
                          <span className="check-title">{item.text}</span>
                        </button>
                        {description ? (
                          <>
                            <span className="desc-print">{description}</span>
                            <ItemTip text={description} />
                          </>
                        ) : null}
                      </div>
                      {isCustom && viewing.canEdit ? (
                        <button
                          className="custom-remove"
                          type="button"
                          aria-label={`Remove ${item.text}`}
                          onClick={() => setRemoveItem({ id: item.id, text: item.text })}
                        >
                          ×
                        </button>
                      ) : null}
                      {viewing.canEdit ? (
                      <button
                        className={`note-toggle${note ? " has-note" : ""}`}
                        type="button"
                        aria-expanded={noteOpen}
                        onClick={() => {
                          if (openNote && openNote !== item.id) {
                            const previous = progress[openNote];
                            void saveProgress(openNote, Boolean(previous?.checked), draft);
                          }
                          if (noteOpen) {
                            void saveProgress(item.id, checked, draft);
                            setOpenNote(null);
                            return;
                          }
                          setDraft(note);
                          setOpenNote(item.id);
                        }}
                      >
                        <span className="note-label-full">Add note</span>
                        <span className="note-label-short">Note</span>
                      </button>
                      ) : note ? (
                        <p className="muted" style={{ fontSize: 13 }}>{note}</p>
                      ) : null}
                    </div>
                    {noteOpen ? (
                      <div className="note-box">
                        <input
                          maxLength={100}
                          placeholder="Add a short note"
                          value={draft}
                          autoFocus
                          enterKeyHint="done"
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => void saveProgress(item.id, checked, draft)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            void saveProgress(item.id, checked, draft);
                            setOpenNote(null);
                          }}
                        />
                        <p className="note-hint">
                          <span className="note-hint-enter">Press Enter to save</span>
                          <span className="note-hint-done">Press Done to save</span>
                        </p>
                      </div>
                    ) : note ? (
                      <p className="note-preview">{note}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {addingTo ? (
        <AddItemModal
          sectionTitle={addingTo.title}
          used={customCountInSection(customItems, addingTo.id)}
          cap={customItemCap()}
          onClose={() => setAddingTo(null)}
          onAdd={async (text, description) => {
            await addCustomItem(addingTo.id, text, description);
            setAddingTo(null);
          }}
        />
      ) : null}
      {removeItem ? (
        <ConfirmDialog
          title="Remove this item?"
          body={`Remove “${removeItem.text}” from this list?`}
          confirmLabel="Remove item"
          danger
          onClose={() => setRemoveItem(null)}
          onConfirm={() => {
            void removeCustomItem(removeItem.id);
            setRemoveItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AddItemModal({
  sectionTitle,
  used,
  cap,
  onClose,
  onAdd,
}: {
  sectionTitle: string;
  used: number;
  cap: number;
  onClose: () => void;
  onAdd: (text: string, description: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const atCap = used >= cap;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (atCap) return;
    setError("");
    setSaving(true);
    try {
      await onAdd(text, description);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add that item.";
      setError(message === ITEM_LIMIT_ERROR ? "This section is full." : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel sheet-panel add-item-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <p className="eyebrow">Add to this list</p>
        <h2 id="add-item-title">{sectionTitle}</h2>
        <p className="muted add-item-lead">
          This item stays in {sectionTitle}. You can add up to {cap} custom items in this section.
        </p>
        {atCap ? (
          <div className="add-item-limit">
            <p>You&apos;ve added the maximum of {cap} custom items to this section.</p>
            <p className="muted">{used} of {cap} custom items used.</p>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <label className="field">
              <span>Item</span>
              <input
                required
                maxLength={120}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What should we add?"
                autoFocus
              />
            </label>
            <label className="field">
              <span>Tip (optional)</span>
              <textarea
                maxLength={280}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short reminder that shows on the info icon"
              />
            </label>
            <p className="add-item-slots">
              {used} of {cap} custom items used
            </p>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add item"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ItemTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`item-tip${open ? " open" : ""}`}>
      <button
        className="item-tip-btn"
        type="button"
        aria-label="Info"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onBlur={() => setOpen(false)}
      >
        <span className="item-tip-icon" aria-hidden="true" />
      </button>
      <span className="item-tip-pop" role="tooltip">
        {text}
      </span>
    </span>
  );
}
