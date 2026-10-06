import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { PHOTO_LIBRARY, SYSTEM_PHOTOS } from "../lib/photos";
import { SURVIVAL_VAULT_DESCRIPTION } from "../lib/pricing";
import { infoForItem } from "../data/itemTips";
import { OFFICIAL_GUIDANCE_DISCLAIMER, QUICK_START_BANNER, quickStartMinutes } from "../lib/copy";
import { NOTE_SENSITIVITY_WARNING, printDisclaimer } from "../lib/legal";

export function SystemPage() {
  const { slug } = useParams();
  const { catalog, progress, saveProgress, sync, customItems, addCustomItem, removeCustomItem, hasSurvivalVault, viewing } = useApp();
  const system = catalog.systems.find((s) => s.slug === slug);
  const sections = useMemo(
    () => catalog.sections.filter((s) => s.system_id === system?.id).sort((a, b) => a.sort_order - b.sort_order),
    [catalog.sections, system?.id],
  );
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [openNoteTip, setOpenNoteTip] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addingTo, setAddingTo] = useState<{ id: string; title: string } | null>(null);
  const [removeItem, setRemoveItem] = useState<{ id: string; text: string } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [quickStartOnly, setQuickStartOnly] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const lastSavedAt = useMemo(() => {
    const stamps = sections
      .flatMap((section) => itemsForSection(catalog.items, customItems, section.id))
      .map((item) => progress[item.id]?.updated_at)
      .filter((value): value is string => Boolean(value))
      .sort();
    return stamps.at(-1) ?? null;
  }, [catalog.items, customItems, progress, sections]);

  const listStats = useMemo(() => {
    const all = sections.flatMap((section) => itemsForSection(catalog.items, customItems, section.id));
    const done = all.filter((item) => progress[item.id]?.checked).length;
    const quick = all.filter((item) => item.quick_start);
    const quickDone = quick.filter((item) => progress[item.id]?.checked).length;
    return {
      done,
      total: all.length,
      pct: all.length ? Math.round((done / all.length) * 100) : 0,
      quickDone,
      quickTotal: quick.length,
    };
  }, [catalog.items, customItems, progress, sections]);

  const qsMinutes = quickStartMinutes(system?.time_label);

  useEffect(() => {
    if (!openTip) return;
    const timer = window.setTimeout(() => setOpenTip(null), 4000);
    return () => window.clearTimeout(timer);
  }, [openTip]);

  useEffect(() => {
    if (!printOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!printMenuRef.current?.contains(event.target as Node)) setPrintOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [printOpen]);

  useEffect(() => {
    if (!openTip && !openNoteTip) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".item-tip-wrap, .note-tip-wrap")) return;
      setOpenTip(null);
      setOpenNoteTip(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openTip, openNoteTip]);

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

  const bannerKey = SYSTEM_PHOTOS[system.slug];
  const bannerSrc = bannerKey ? PHOTO_LIBRARY[bannerKey] : "";

  function printList(blank: boolean) {
    setPrintOpen(false);
    const root = document.documentElement;
    if (blank) root.classList.add("print-blank");
    const cleanup = () => {
      root.classList.remove("print-blank");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1500);
  }

  return (
    <div className="list-page">
      <div className="print-header">
        <h1>Safety Prep List: {system.title}</h1>
        <p>Printed {new Date().toLocaleDateString()}</p>
        <p className="print-legal-footer">{printDisclaimer()}</p>
      </div>
      <div className="print-actions">
        <Link className="btn btn-ghost" to="/app">Back</Link>
        <div className="print-menu" ref={printMenuRef}>
          <button
            className="btn btn-forest"
            type="button"
            aria-expanded={printOpen}
            aria-haspopup="menu"
            onClick={() => setPrintOpen((open) => !open)}
          >
            Print
          </button>
          {printOpen ? (
            <div className="print-menu-drop" role="menu">
              <button type="button" role="menuitem" onClick={() => printList(false)}>
                With current checkmarks
              </button>
              <button type="button" role="menuitem" onClick={() => printList(true)}>
                Blank checklist
              </button>
            </div>
          ) : null}
        </div>
        <p className={`list-saved ${sync === "waiting" ? "wait" : ""}`}>
          <b>
            {sync === "saving" ? "Saving…" : sync === "waiting" ? "Waiting to sync" : lastSavedAt ? "Saved" : ""}
          </b>
          {lastSavedAt ? <span>{formatDateTime(lastSavedAt)}</span> : null}
        </p>
      </div>
      {qsMinutes != null ? (
        <p className="quick-start-banner">{QUICK_START_BANNER}</p>
      ) : null}
      <header className={`list-hero${bannerSrc ? " has-banner" : ""} list-hero-${system.slug}`}>
        {bannerSrc ? (
          <div className="list-hero-banner" aria-hidden="true">
            <img src={bannerSrc} alt="" />
          </div>
        ) : null}
        <div>
          {qsMinutes != null ? (
            <p className="time-label list-quickstart-time">Quick Start: ~{qsMinutes} min once supplies are gathered</p>
          ) : system.time_label ? (
            <p className="time-label">{system.time_label}</p>
          ) : null}
          <h1>{system.title}</h1>
          {system.description ? <p className="list-lead">{system.description}</p> : null}
        </div>
        <div className="list-hero-progress">
          <b>{listStats.pct}%</b>
          <span>{listStats.done} of {listStats.total} checked</span>
        </div>
      </header>
      {qsMinutes != null ? (
        <div className="quick-start-bar">
          <label className="quick-start-toggle">
            <input
              type="checkbox"
              checked={quickStartOnly}
              onChange={(event) => setQuickStartOnly(event.target.checked)}
            />
            Quick Start only
          </label>
          <p className="quick-start-progress">
            Quick Start: {listStats.quickDone} of {listStats.quickTotal} done
          </p>
        </div>
      ) : null}

      {sections.map((section) => {
        const items = itemsForSection(catalog.items, customItems, section.id).filter((item) =>
          quickStartOnly && qsMinutes != null ? item.quick_start : true,
        );
        if (!items.length) return null;
        const customIds = new Set(customItems.filter((item) => item.section_id === section.id).map((item) => item.id));
        return (
          <section className="list-group" key={section.id}>
            <header className="list-group-head">
              <div className="list-group-title">
                <h3>{section.title}</h3>
                {section.intro ? <SectionTip text={section.intro} sectionTitle={section.title} /> : null}
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
            {section.intro ? <p className="section-intro-print">{section.intro}</p> : null}
            <div className="list-group-body">
              {items.map((item) => {
                const row = progress[item.id];
                const checked = Boolean(row?.checked);
                const note = row?.note || "";
                const noteOpen = openNote === item.id;
                const tipOpen = openTip === item.id;
                const noteTipOpen = openNoteTip === item.id;
                const description = infoForItem(item.permanent_key, item.description);
                const isCustom = customIds.has(item.id);
                return (
                  <article className={`check-item${checked ? " is-done" : ""}`} key={item.id}>
                    <div className="check-row">
                      <button
                        data-onboarding="check-item"
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
                        {description ? <span className="desc-print">{description}</span> : null}
                      </div>
                      {description ? (
                        <ItemTip
                          open={tipOpen}
                          text={description}
                          onToggle={() => {
                            setOpenNote(null);
                            setOpenNoteTip(null);
                            setOpenTip((current) => (current === item.id ? null : item.id));
                          }}
                        />
                      ) : null}
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
                      {viewing.canEdit || note ? (
                      <div className={`note-tip-wrap${noteTipOpen ? " open" : ""}`}>
                        <button
                          data-onboarding="notes"
                          className={`note-toggle${note ? " has-note" : " add-note"}`}
                          type="button"
                          aria-expanded={noteOpen || noteTipOpen}
                          onClick={() => {
                            setOpenTip(null);
                            if (note && !noteOpen) {
                              setOpenNote(null);
                              setOpenNoteTip((current) => (current === item.id ? null : item.id));
                              return;
                            }
                            if (openNote && openNote !== item.id) {
                              const previous = progress[openNote];
                              void saveProgress(openNote, Boolean(previous?.checked), draft);
                            }
                            if (noteOpen) {
                              void saveProgress(item.id, checked, draft);
                              setOpenNote(null);
                              return;
                            }
                            setOpenNoteTip(null);
                            setDraft(note);
                            setOpenNote(item.id);
                          }}
                        >
                          {note ? "View note" : "Add note"}
                        </button>
                        {noteTipOpen && note ? (
                          <div className="item-pop note" role="tooltip">
                            <span className="item-pop-kicker">Note</span>
                            {note}
                          </div>
                        ) : null}
                      </div>
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
                          onBlur={() => {
                            void saveProgress(item.id, checked, draft);
                            setOpenNote(null);
                          }}
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
                        <p className="note-sensitivity">{NOTE_SENSITIVITY_WARNING}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="list-disclaimer">{OFFICIAL_GUIDANCE_DISCLAIMER}</p>

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
                placeholder="Shows as a tooltip on the info icon"
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

function SectionTip({
  text,
  sectionTitle,
}: {
  text: string;
  sectionTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={wrapRef} className={`section-tip-wrap${open ? " open" : ""}`}>
      <button
        className={`item-tip${open ? " open" : ""}`}
        type="button"
        aria-label={open ? `Hide details for ${sectionTitle}` : `About ${sectionTitle}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <span className="item-tip-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9.25" fill="#fff" stroke="#c3c7bf" strokeWidth="1.5" />
            <circle cx="12" cy="8.1" r="1.15" fill="#5f6560" />
            <path d="M12 10.7v6.1" stroke="#5f6560" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div className="item-pop info" role="tooltip">
        {text}
      </div>
    </div>
  );
}

function ItemTip({
  open,
  text,
  onToggle,
}: {
  open: boolean;
  text: string;
  onToggle: () => void;
}) {
  return (
    <div className={`item-tip-wrap${open ? " open" : ""}`}>
      <button
        className={`item-tip${open ? " open" : ""}`}
        type="button"
        aria-label={open ? "Hide item details" : "Show item details"}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <span className="item-tip-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9.25" fill="#fff" stroke="#c3c7bf" strokeWidth="1.5" />
            <circle cx="12" cy="8.1" r="1.15" fill="#5f6560" />
            <path d="M12 10.7v6.1" stroke="#5f6560" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="item-pop info" role="tooltip">
          <span className="item-pop-kicker">Tip</span>
          {text}
        </div>
      ) : null}
    </div>
  );
}
