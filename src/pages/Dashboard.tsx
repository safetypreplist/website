import { Link } from "react-router-dom";
import { Photo } from "../components/Photo";
import { useApp } from "../context/AppContext";
import { itemsForSections } from "../lib/customItems";
import { greeting, percent } from "../lib/format";
import { initialsFrom } from "../lib/identity";
import { PHOTO_LIBRARY, SYSTEM_PHOTOS } from "../lib/photos";
import type { ChecklistSystem, CustomChecklistItem } from "../types";

type Accent = "forest" | "moss" | "clay" | "terracotta";

const SYSTEM_ACCENTS: Record<string, Accent> = {
  "grab-go": "moss",
  "ready-bag": "clay",
  "vehicle-suitcase": "terracotta",
  "home-resilience": "forest",
  "off-grid": "moss",
  "water-purification": "clay",
  "battery-solar": "terracotta",
  "cooling-heat": "forest",
  "long-term-food": "moss",
};

export function DashboardPage() {
  const {
    profile,
    catalog,
    progress,
    sync,
    online,
    customItems,
    viewing,
    hasSurvivalVault,
    switchChecklist,
  } = useApp();
  const entitled = profile?.plan === "core" || profile?.plan === "full";
  const personalSystems = catalog.systems.filter((s) => s.access_tier === "core");
  const householdSystems = catalog.systems.filter((s) => s.access_tier === "full");
  const isHousehold = viewing.kind === "household";
  const systems = isHousehold ? householdSystems : personalSystems;

  const visibleSections = catalog.sections.filter((section) => {
    const system = catalog.systems.find((s) => s.id === section.system_id);
    if (!system) return false;
    return systems.some((s) => s.id === system.id);
  });
  const visibleItems = itemsForSections(catalog.items, customItems, visibleSections);
  const done = visibleItems.filter((item) => progress[item.id]?.checked).length;
  const pct = percent(done, visibleItems.length);
  const continueSystem = entitled ? findContinueSystem(systems, catalog, customItems, progress) : null;
  const householdPct = householdProgress(catalog, customItems, progress);

  return (
    <div className="dash-home">
      <div className="dash-identity">
        <span className="dash-avatar">
          {viewing.avatarUrl ? <img src={viewing.avatarUrl} alt="" /> : <span>{initialsFrom(viewing.ownerName)}</span>}
        </span>
        <div>
          {viewing.isOwn ? <p className="dash-greeting">{greeting(viewing.ownerName)}</p> : null}
          <h1 className="dash-heading">{isHousehold ? "Survival Vault" : viewing.title}</h1>
          {viewing.publicId ? <p className="checklist-id-line">{viewing.publicId}</p> : null}
          {!viewing.isOwn && !isHousehold && !viewing.canEdit ? <p className="muted">View Only</p> : null}
        </div>
      </div>

      <div className="readiness">
        <div className="readiness-photo" aria-hidden="true">
          <img src={PHOTO_LIBRARY.landscape} alt="" />
        </div>
        <div className="eyebrow">Your Readiness</div>
        <div className="readiness-meter">
          <svg className="ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(230,226,214,.18)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#C4A07A"
              strokeWidth="10"
              strokeDasharray={`${Math.round(2 * Math.PI * 48 * (pct / 100))} ${Math.round(2 * Math.PI * 48)}`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="68" textAnchor="middle" fill="#F4F0E5" fontSize="28" fontWeight="700" fontFamily="Inter Tight">
              {pct}%
            </text>
          </svg>
          <div>
            <p className="readiness-count">
              <b>{done}</b> of {visibleItems.length} items checked
            </p>
            <p className={`sync-pill ${sync === "waiting" ? "wait" : ""}`}>
              {!online ? "Offline" : sync === "waiting" ? "Waiting to sync" : sync === "saved" ? "Synced" : sync === "saving" ? "Saving…" : "Ready"}
            </p>
          </div>
        </div>
      </div>

      {!entitled && (
        <div className="status-banner">
          This account does not have a personal checklist yet. Complete purchase, then create the account with your Product ID.
          <div style={{ marginTop: 10 }}>
            <Link className="btn btn-primary" to="/pricing">Get My Checklist</Link>
          </div>
        </div>
      )}

      {continueSystem && (
        <Link className="continue-card" to={`/app/lists/${continueSystem.slug}`}>
          <div className="continue-copy">
            <span className="time-label">Continue My Checklist</span>
            <h4>{continueSystem.title}</h4>
            <p>{continueSystem.done} of {continueSystem.total} checked</p>
            <div className="bar continue-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(continueSystem.pct * 100)}%` }} />
            </div>
          </div>
          <span className="continue-go">Resume</span>
        </Link>
      )}

      <p className="dash-section-title">{isHousehold ? "Survival Vault" : "My Checklist"}</p>
      <div className="system-list">
        {systems.map((system) => (
          <SystemRow key={system.id} slug={system.slug} />
        ))}
      </div>

      {viewing.isOwn && !isHousehold ? (
        <>
          {hasSurvivalVault ? (
            <article className="account-card" style={{ marginTop: 18 }}>
              <h3>Survival Vault</h3>
              <p className="muted">Advanced preparedness: {householdPct}%</p>
              <Link className="btn btn-primary" to="/app/survival" onClick={() => void switchChecklist("household")}>
                Open Survival Vault
              </Link>
            </article>
          ) : entitled ? (
            <div className="locked-panel" style={{ textAlign: "left", padding: "28px 22px" }}>
              <h2>Want to go beyond the basics?</h2>
              <p className="muted" style={{ color: "rgba(244,240,229,.72)", marginTop: 8 }}>
                Unlock advanced preparedness resources for off-grid systems, water purification, backup battery and solar,
                emergency heating and cooling, long-term food, and How-To Videos. $10 one time, not $10 per person.
              </p>
              <Link className="btn btn-primary" style={{ marginTop: 18 }} to="/app/account#addons">
                Add Survival Vault
              </Link>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function ListsPage() {
  const { catalog, viewing, switchChecklist, hasSurvivalVault } = useApp();
  const coreSystems = catalog.systems.filter((s) => s.access_tier === "core");

  return (
    <div>
      <h1 className="page-title">{viewing.kind === "household" ? "Survival Vault" : viewing.title}</h1>
      <div className="system-list">
        {(viewing.kind === "household" ? catalog.systems.filter((s) => s.access_tier === "full") : coreSystems).map((system) => (
          <SystemRow key={system.id} slug={system.slug} />
        ))}
      </div>
      {viewing.kind === "household" ? (
        <p className="muted" style={{ marginTop: 18 }}>
          <Link to="/app/survival/videos">How-To Videos</Link>
        </p>
      ) : hasSurvivalVault ? (
        <p className="muted" style={{ marginTop: 18 }}>
          Looking for water, power, or off-grid systems?{" "}
          <Link to="/app/survival" onClick={() => void switchChecklist("household")}>Open Survival Vault</Link>
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 18 }}>
          Looking for water, power, or off-grid systems?{" "}
          <Link to="/app/account#addons">Unlock Survival Vault</Link>
        </p>
      )}
    </div>
  );
}

function householdProgress(
  catalog: ReturnType<typeof useApp>["catalog"],
  customItems: CustomChecklistItem[],
  progress: ReturnType<typeof useApp>["progress"],
) {
  const systems = catalog.systems.filter((s) => s.access_tier === "full");
  const sections = catalog.sections.filter((section) => systems.some((s) => s.id === section.system_id));
  const items = itemsForSections(catalog.items, customItems, sections);
  const done = items.filter((item) => progress[item.id]?.checked).length;
  return percent(done, items.length);
}

function findContinueSystem(
  systems: ChecklistSystem[],
  catalog: ReturnType<typeof useApp>["catalog"],
  customItems: CustomChecklistItem[],
  progress: ReturnType<typeof useApp>["progress"],
) {
  let best: { slug: string; title: string; done: number; total: number; pct: number } | null = null;
  for (const system of systems) {
    const sections = catalog.sections.filter((s) => s.system_id === system.id);
    const items = itemsForSections(catalog.items, customItems, sections);
    if (!items.length) continue;
    const done = items.filter((i) => progress[i.id]?.checked).length;
    if (done === 0 || done === items.length) continue;
    const pct = done / items.length;
    if (!best || pct > best.pct) {
      best = { slug: system.slug, title: system.title, done, total: items.length, pct };
    }
  }
  return best;
}

export function SystemRow({ slug }: { slug: string }) {
  const { catalog, progress, profile, customItems, hasSurvivalVault, viewing } = useApp();
  const system = catalog.systems.find((s) => s.slug === slug);
  if (!system) return null;
  const sections = catalog.sections.filter((s) => s.system_id === system.id);
  const items = itemsForSections(catalog.items, customItems, sections);
  const done = items.filter((i) => progress[i.id]?.checked).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const locked =
    profile?.plan === "none" || (system.access_tier === "full" && !hasSurvivalVault);
  const to =
    profile?.plan === "none"
      ? "/pricing"
      : system.access_tier === "full" && !hasSurvivalVault
        ? "/app/account#addons"
        : `/app/lists/${system.slug}`;

  return (
    <article className={`system-card ${locked ? "locked" : ""}`}>
      <div className="illu">
        <Photo alt={system.title} subject={SYSTEM_PHOTOS[system.slug]} ratio="square" accent={SYSTEM_ACCENTS[system.slug] ?? "forest"} />
      </div>
      <div className="body">
        <div className="time">{system.time_label}</div>
        <h3>{system.title}</h3>
        <p>{system.description}</p>
        <div className="progress-meta">
          <span>
            {done} / {items.length} complete
          </span>
          <span>{pct}%</span>
        </div>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <Link className={`btn ${locked ? "btn-forest" : "btn-moss"}`} to={to}>
          {locked
            ? system.access_tier === "full"
              ? "Available with Survival Vault"
              : "Unlock"
            : viewing.canEdit
              ? "Open list"
              : "View list"}
        </Link>
      </div>
    </article>
  );
}
