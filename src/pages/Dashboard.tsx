import { useState } from "react";
import { Link } from "react-router-dom";
import { Photo } from "../components/Photo";
import { useApp } from "../context/AppContext";
import { greeting, percent } from "../lib/format";
import { initialsFrom } from "../lib/identity";
import { PHOTO_LIBRARY, SYSTEM_PHOTOS } from "../lib/photos";
import { SCOPE_LINE, SCOPE_SUPPORT, VAULT_APP_DESCRIPTION } from "../lib/copy";
import { isTimedSystem, readPrepLane, trackedItems } from "../lib/listProgress";
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
  } = useApp();
  const entitled = profile?.plan === "core" || profile?.plan === "full";
  const personalSystems = catalog.systems.filter((s) => s.access_tier === "core");
  const householdSystems = catalog.systems.filter((s) => s.access_tier === "full");
  const isHousehold = viewing.kind === "household";
  const systems = (isHousehold ? householdSystems : personalSystems)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const startSystems = systems.filter((system) => isTimedSystem(system));
  const lane = readPrepLane();

  const visibleItems = startSystems.flatMap((system) =>
    trackedItems(system, catalog.sections, catalog.items, customItems, lane),
  );
  const done = visibleItems.filter((item) => progress[item.id]?.checked).length;
  const pct = percent(done, visibleItems.length);
  const continueLists = isHousehold
    ? systems
    : hasSurvivalVault
      ? [...startSystems, ...vaultSystems(catalog.systems)]
      : startSystems;
  const continueSystem = entitled ? findContinueSystem(continueLists, catalog, customItems, progress) : null;

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
        </div>
      </div>

      <NotificationPrompt />

      <div className="readiness">
        <div className="readiness-photo" aria-hidden="true">
          <img src={PHOTO_LIBRARY.landscape} alt="" />
        </div>
        <div className="readiness-head">
          <div className="eyebrow">Checklist Progress</div>
          <p className={`sync-pill ${sync === "waiting" ? "wait" : ""}`}>
            {!online ? "Offline" : sync === "waiting" ? "Waiting to sync" : sync === "saved" ? "Synced" : sync === "saving" ? "Saving…" : "Ready"}
          </p>
        </div>
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
          </div>
        </div>
      </div>

      {!entitled && (
        <div className="status-banner">
          We couldn’t confirm this subscription yet. If you just purchased, give it a moment — or contact help if payment didn’t go through.
          <div style={{ marginTop: 10 }}>
            <Link className="btn btn-ghost" to="/app/help">Get help</Link>
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

      <p className="dash-section-title">{isHousehold ? "Survival Vault" : "Start here"}</p>
      {!isHousehold ? (
        <p className="dash-scope">
          {SCOPE_LINE} {SCOPE_SUPPORT}
        </p>
      ) : null}
      <div className="system-list">
        {(isHousehold ? systems : startSystems).map((system) => (
          <SystemRow key={system.id} slug={system.slug} />
        ))}
      </div>
      {viewing.isOwn && !isHousehold ? <SurvivalVaultBlock /> : null}
    </div>
  );
}

function NotificationPrompt() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : "denied");
  if (!supported || permission === "granted") return null;
  async function enable() {
    const next = await Notification.requestPermission();
    setPermission(next);
  }
  return <aside className="notification-prompt" role="status"><span className="notification-prompt-icon">●</span><span><b>Turn notifications on</b><small>Get a browser alert when a support chat is waiting for you.</small></span><button className="btn btn-forest" type="button" onClick={() => void enable()}>Turn on</button></aside>;
}

const VAULT_SLUGS = ["off-grid", "water-purification", "battery-solar", "cooling-heat", "long-term-food"];

function vaultSystems(systems: ChecklistSystem[]) {
  return VAULT_SLUGS.map((slug) => systems.find((system) => system.slug === slug)).filter((system): system is ChecklistSystem => Boolean(system));
}

function SurvivalVaultBlock() {
  const { catalog, hasSurvivalVault, profile, switchChecklist } = useApp();
  const entitled = profile?.plan === "core" || profile?.plan === "full";
  if (!hasSurvivalVault && !entitled) return null;
  const systems = vaultSystems(catalog.systems);

  return (
    <>
      <p className="dash-section-title">Survival Vault</p>
      {hasSurvivalVault ? (
        <div className="system-list">
          {systems.map((system) => (
            <SystemRow key={system.id} slug={system.slug} />
          ))}
          <SafetyVideoCard onOpen={() => void switchChecklist("household")} />
        </div>
      ) : (
        <div className="locked-panel" style={{ textAlign: "left", padding: "28px 22px" }}>
          <h2>Want to go beyond the basics?</h2>
          <p className="muted" style={{ color: "rgba(244,240,229,.72)", marginTop: 8 }}>
            {VAULT_APP_DESCRIPTION}
          </p>
          <Link className="btn btn-primary" style={{ marginTop: 18 }} to="/app/account#addons">
            Add Survival Vault
          </Link>
        </div>
      )}
    </>
  );
}

function SafetyVideoCard({ onOpen }: { onOpen: () => void }) {
  return (
    <article className="system-card">
      <div className="illu">
        <Photo alt="Safety Video Collection" subject="video" ratio="square" accent="forest" />
      </div>
      <div className="body">
        <h3>Safety Video Collection</h3>
        <p>Watch the skills when you need them. Practical visual learning for water, power, off-grid, food, communications, and home readiness.</p>
        <Link className="btn btn-moss" to="/app/survival/videos" onClick={onOpen}>
          Open videos
        </Link>
      </div>
    </article>
  );
}

export function ListsPage() {
  const { catalog, viewing, hasSurvivalVault } = useApp();
  const startSystems = catalog.systems
    .filter((system) => system.access_tier === "core" && isTimedSystem(system))
    .sort((a, b) => a.sort_order - b.sort_order);
  const household = viewing.kind === "household";

  return (
    <div>
      <h1 className="page-title">{household ? "Survival Vault" : viewing.title}</h1>
      {household ? (
        <div className="system-list">
          {vaultSystems(catalog.systems).map((system) => (
            <SystemRow key={system.id} slug={system.slug} />
          ))}
          {hasSurvivalVault ? <SafetyVideoCard onOpen={() => undefined} /> : null}
        </div>
      ) : (
        <>
          <p className="dash-section-title">Start here</p>
          <div className="system-list">
            {startSystems.map((system) => (
              <SystemRow key={system.id} slug={system.slug} />
            ))}
          </div>
          {viewing.isOwn ? <SurvivalVaultBlock /> : null}
        </>
      )}
    </div>
  );
}

function findContinueSystem(
  systems: ChecklistSystem[],
  catalog: ReturnType<typeof useApp>["catalog"],
  customItems: CustomChecklistItem[],
  progress: ReturnType<typeof useApp>["progress"],
) {
  let best: { slug: string; title: string; done: number; total: number; pct: number } | null = null;
  const lane = readPrepLane();
  const ordered = [...systems].sort((a, b) => Number(isTimedSystem(b)) - Number(isTimedSystem(a)) || a.sort_order - b.sort_order);
  for (const system of ordered) {
    const items = trackedItems(system, catalog.sections, catalog.items, customItems, lane);
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
  const { catalog, progress, profile, customItems, hasSurvivalVault, viewing, switchChecklist } = useApp();
  const system = catalog.systems.find((s) => s.slug === slug);
  if (!system) return null;
  const lane = readPrepLane();
  const items = trackedItems(system, catalog.sections, catalog.items, customItems, lane);
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
    <article data-onboarding="checklist-card" className={`system-card ${locked ? "locked" : ""}`}>
      <div className="illu">
        <Photo alt={system.title} subject={SYSTEM_PHOTOS[system.slug]} ratio="square" accent={SYSTEM_ACCENTS[system.slug] ?? "forest"} />
      </div>
      <div className="body">
        {system.time_label !== "FULL" ? (
          <div className="time">{system.time_label === "MORE" ? "Expanded" : system.time_label}</div>
        ) : null}
        <h3>{system.title}</h3>
        <p>{system.description}</p>
        <div className="progress-meta">
          <span>
            {done} / {items.length} {isTimedSystem(system) ? "priority" : "complete"}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <Link
          className={`btn ${locked ? "btn-forest" : "btn-moss"}`}
          to={to}
          onClick={() => {
            if (system.access_tier === "full" && hasSurvivalVault) void switchChecklist("household");
          }}
        >
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
