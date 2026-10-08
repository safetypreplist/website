import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SurvivalVaultPurchase } from "../components/SurvivalVaultPurchase";
import { useApp } from "../context/AppContext";
import {
  ITEM_LIMIT_ERROR,
  customCountInSection,
  customItemCap,
  itemsForSection,
} from "../lib/customItems";
import { formatDateTime } from "../lib/format";
import { PHOTO_LIBRARY, SYSTEM_PHOTOS } from "../lib/photos";
import { infoForItem } from "../data/itemTips";
import { OFFICIAL_GUIDANCE_DISCLAIMER, VAULT_APP_DESCRIPTION, quickStartIntro, quickStartMinutes } from "../lib/copy";
import {
  isExtendedItem,
  isPrimaryItem,
  isTimedSystem,
  itemsOnSections,
  readPrepLane,
  sectionsForSystem,
  sortVehiclePrimary,
  trackedItems,
  writePrepLane,
  type PrepLane,
} from "../lib/listProgress";
import { NOTE_SENSITIVITY_WARNING, printDisclaimer } from "../lib/legal";
import type { ChecklistItem, ProgressRow } from "../types";

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
  const [lane, setLane] = useState<PrepLane>(() => readPrepLane());
  const [moreTimeOpen, setMoreTimeOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const lastSavedAt = useMemo(() => {
    const stamps = sections
      .flatMap((section) => itemsForSection(catalog.items, customItems, section.id))
      .map((item) => progress[item.id]?.updated_at)
      .filter((value): value is string => Boolean(value))
      .sort();
    return stamps.at(-1) ?? null;
  }, [catalog.items, customItems, progress, sections]);

  const orderedSections = useMemo(
    () => (system ? sectionsForSystem(catalog.sections, system, system.slug === "vehicle-suitcase" ? lane : null) : []),
    [catalog.sections, lane, system],
  );

  const listStats = useMemo(() => {
    if (!system) return { done: 0, total: 0, pct: 0 };
    const tracked = trackedItems(system, catalog.sections, catalog.items, customItems, lane);
    const done = tracked.filter((item) => progress[item.id]?.checked).length;
    return {
      done,
      total: tracked.length,
      pct: tracked.length ? Math.round((done / tracked.length) * 100) : 0,
    };
  }, [catalog.items, catalog.sections, customItems, lane, progress, system]);

  const qsMinutes = quickStartMinutes(system?.time_label);
  const timed = isTimedSystem(system);

  const primaryGroups = useMemo(() => {
    if (!system || !timed) return [];
    if (system.slug === "vehicle-suitcase") {
      const items = sortVehiclePrimary(
        itemsOnSections(orderedSections, catalog.items, customItems).filter(isPrimaryItem),
      );
      if (!items.length) return [];
      return [
        {
          key: "primary",
          title: lane === "suitcase" ? "Suitcase Prep" : "Vehicle Prep",
          intro: quickStartIntro(qsMinutes ?? 20),
          items,
          sectionId: null as string | null,
        },
      ];
    }
    return orderedSections
      .map((section) => ({
        key: section.id,
        title: section.title,
        intro: section.intro || quickStartIntro(qsMinutes ?? 0),
        items: itemsForSection(catalog.items, customItems, section.id).filter(isPrimaryItem),
        sectionId: section.id,
      }))
      .filter((group) => group.items.length);
  }, [catalog.items, customItems, lane, orderedSections, qsMinutes, system, timed]);

  const moreGroups = useMemo(() => {
    if (!system) return [];
    const groups = orderedSections
      .map((section) => ({
        key: section.id,
        title:
          system.slug === "grab-go"
            ? "Additional Grab-and-Go Items"
            : timed
              ? section.more_title || section.title
              : section.title,
        intro: section.intro,
        items: itemsForSection(catalog.items, customItems, section.id).filter(
          (item) => !isExtendedItem(item) && (!timed || !isPrimaryItem(item)),
        ),
        sectionId: section.id,
      }))
      .filter((group) => group.items.length);
    const merged = new Map<string, (typeof groups)[number]>();
    for (const group of groups) {
      const existing = merged.get(group.title);
      if (!existing) merged.set(group.title, { ...group, items: [...group.items] });
      else existing.items.push(...group.items);
    }
    const combined = [...merged.values()];
    if (system.slug !== "vehicle-suitcase" || lane !== "vehicle") return combined;
    const vehicleItems = combined.flatMap((group) => group.items);
    if (!vehicleItems.length) return [];
    return [
      {
        key: "vehicle-more",
        title: "Vehicle Safety & Recovery",
        intro: "The rest of the vehicle kit. These items do not count toward the 20-minute session.",
        items: vehicleItems,
        sectionId: orderedSections[0]?.id ?? null,
      },
    ];
  }, [catalog.items, customItems, lane, orderedSections, system, timed]);

  const extendedGroups = useMemo(
    () =>
      orderedSections
        .map((section) => ({
          key: section.id,
          title: section.title,
          items: itemsForSection(catalog.items, customItems, section.id).filter(isExtendedItem),
        }))
        .filter((group) => group.items.length),
    [catalog.items, customItems, orderedSections],
  );
  const extendedItems = extendedGroups.flatMap((group) => group.items);
  const extendedAdded = extendedItems.filter((item) => progress[item.id]?.checked).length;

  const customIds = useMemo(() => new Set(customItems.map((item) => item.id)), [customItems]);

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
        <p className="muted">{VAULT_APP_DESCRIPTION}</p>
        <SurvivalVaultPurchase />
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
      <header className={`list-hero${bannerSrc ? " has-banner" : ""} list-hero-${system.slug}`}>
        {bannerSrc ? (
          <div className="list-hero-banner" aria-hidden="true">
            <img src={bannerSrc} alt="" />
          </div>
        ) : null}
        <div>
          {qsMinutes == null && system.time_label && system.time_label !== "MORE" ? <p className="time-label">{system.time_label}</p> : null}
          <h1>{system.title}</h1>
          {system.description ? <p className="list-lead">{system.description}</p> : null}
        </div>
        <div className="list-hero-progress">
          <b>{listStats.pct}%</b>
          <span>
            {listStats.done} of {listStats.total} {timed ? "priority items" : "checked"}
          </span>
        </div>
      </header>

      {system.slug === "vehicle-suitcase" ? (
        <div className="lane-switch" role="tablist" aria-label="Preparation path">
          <button
            type="button"
            role="tab"
            aria-selected={lane === "vehicle"}
            className={lane === "vehicle" ? "on" : ""}
            onClick={() => {
              setLane("vehicle");
              writePrepLane("vehicle");
            }}
          >
            Vehicle Prep
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={lane === "suitcase"}
            className={lane === "suitcase" ? "on" : ""}
            onClick={() => {
              setLane("suitcase");
              writePrepLane("suitcase");
            }}
          >
            Suitcase Prep
          </button>
        </div>
      ) : null}

      {primaryGroups.map((group) => (
        <ListGroup
          key={group.key}
          title={group.title}
          intro={group.intro}
          items={group.items}
          sectionId={group.sectionId}
          customIds={customIds}
          canEdit={viewing.canEdit}
          progress={progress}
          openNote={openNote}
          openTip={openTip}
          openNoteTip={openNoteTip}
          draft={draft}
          setOpenNote={setOpenNote}
          setOpenTip={setOpenTip}
          setOpenNoteTip={setOpenNoteTip}
          setDraft={setDraft}
          setAddingTo={setAddingTo}
          setRemoveItem={setRemoveItem}
          saveProgress={saveProgress}
        />
      ))}
      {moreGroups.map((group) => (
        <ListGroup
          key={group.key}
          title={group.title}
          intro={group.intro}
          items={group.items}
          sectionId={group.sectionId}
          customIds={customIds}
          canEdit={viewing.canEdit}
          progress={progress}
          openNote={openNote}
          openTip={openTip}
          openNoteTip={openNoteTip}
          draft={draft}
          setOpenNote={setOpenNote}
          setOpenTip={setOpenTip}
          setOpenNoteTip={setOpenNoteTip}
          setDraft={setDraft}
          setAddingTo={setAddingTo}
          setRemoveItem={setRemoveItem}
          saveProgress={saveProgress}
        />
      ))}

      {extendedGroups.length ? (
        <section className={`more-time${moreTimeOpen ? " open" : ""}`} aria-label="Have more time?">
          <button
            className="more-time-toggle"
            type="button"
            aria-expanded={moreTimeOpen}
            aria-controls="more-time-body"
            onClick={() => setMoreTimeOpen((open) => !open)}
          >
            <span className="more-time-copy">
              <span className="more-time-title">Have more time?</span>
              <span className="more-time-lead">
                {system.slug === "grab-go"
                  ? "Have another 10 minutes? Add these useful extras if you can."
                  : "Your essentials come first. If you have additional time, consider adding these extras."}
              </span>
            </span>
            <span className="more-time-count">
              {extendedAdded} / {extendedItems.length} added
            </span>
            <span className="more-time-chevron" aria-hidden="true" />
          </button>
          {moreTimeOpen ? (
            <div className="more-time-body" id="more-time-body">
              <p className="more-time-note">Optional extras that add comfort, flexibility, and resilience. They are tracked separately from your progress.</p>
              {extendedGroups.map((group) => (
                <ListGroup
                  key={group.key}
                  title={group.title}
                  intro={null}
                  items={group.items}
                  sectionId={null}
                  customIds={customIds}
                  canEdit={viewing.canEdit}
                  progress={progress}
                  openNote={openNote}
                  openTip={openTip}
                  openNoteTip={openNoteTip}
                  draft={draft}
                  setOpenNote={setOpenNote}
                  setOpenTip={setOpenTip}
                  setOpenNoteTip={setOpenNoteTip}
                  setDraft={setDraft}
                  setAddingTo={setAddingTo}
                  setRemoveItem={setRemoveItem}
                  saveProgress={saveProgress}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <aside className="list-warning" role="note">
        <p>{OFFICIAL_GUIDANCE_DISCLAIMER}</p>
      </aside>

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

function ListGroup({
  title,
  intro,
  items,
  sectionId,
  customIds,
  canEdit,
  progress,
  openNote,
  openTip,
  openNoteTip,
  draft,
  setOpenNote,
  setOpenTip,
  setOpenNoteTip,
  setDraft,
  setAddingTo,
  setRemoveItem,
  saveProgress,
}: {
  title: string;
  intro: string | null;
  items: ChecklistItem[];
  sectionId: string | null;
  customIds: Set<string>;
  canEdit: boolean;
  progress: Record<string, ProgressRow | undefined>;
  openNote: string | null;
  openTip: string | null;
  openNoteTip: string | null;
  draft: string;
  setOpenNote: (value: string | null) => void;
  setOpenTip: (value: string | null | ((current: string | null) => string | null)) => void;
  setOpenNoteTip: (value: string | null | ((current: string | null) => string | null)) => void;
  setDraft: (value: string) => void;
  setAddingTo: (value: { id: string; title: string } | null) => void;
  setRemoveItem: (value: { id: string; text: string } | null) => void;
  saveProgress: (itemId: string, checked: boolean, note: string) => void | Promise<void>;
}) {
  return (
    <section className="list-group">
      <header className="list-group-head">
        <div className="list-group-title">
          <h3>{title}</h3>
          {intro ? <SectionTip text={intro} sectionTitle={title} /> : null}
        </div>
        {canEdit && sectionId ? (
          <button
            className="add-item-btn"
            type="button"
            aria-label={`Add item to ${title}`}
            onClick={() => setAddingTo({ id: sectionId, title })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 6.5v11M6.5 12h11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </header>
      {intro ? <p className="section-intro-print">{intro}</p> : null}
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
                  onClick={() => canEdit && void saveProgress(item.id, !checked, note)}
                  disabled={!canEdit}
                >
                  {checked ? "✓" : ""}
                </button>
                <div className="check-main">
                  <button
                    className="check-copy"
                    type="button"
                    onClick={() => canEdit && void saveProgress(item.id, !checked, note)}
                    disabled={!canEdit}
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
                {isCustom && canEdit ? (
                  <button
                    className="custom-remove"
                    type="button"
                    aria-label={`Remove ${item.text}`}
                    onClick={() => setRemoveItem({ id: item.id, text: item.text })}
                  >
                    ×
                  </button>
                ) : null}
                {canEdit || note ? (
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
