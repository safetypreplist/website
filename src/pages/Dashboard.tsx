import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Photo } from "../components/Photo";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useApp } from "../context/AppContext";
import { greetingPhrase, percent } from "../lib/format";
import { locationDisplayLabel } from "../lib/localProfile";
import { PHOTO_LIBRARY, SYSTEM_PHOTOS } from "../lib/photos";
import { isTimedSystem, readPrepLane, trackedItems } from "../lib/listProgress";
import type { ChecklistSystem, CustomChecklistItem } from "../types";
import { isLicensed } from "../lib/licenseClient";
import { loadImportedLists, type ImportedChecklist } from "../lib/localStore";

function hasPlanAccess(profile: { plan?: string; role?: string } | null | undefined) {
  return isLicensed() || profile?.role === "owner" || profile?.plan === "core" || profile?.plan === "full";
}

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
    customItems,
    viewing,
    hasSurvivalVault,
    localProfile,
    groupStatus,
  } = useApp();
  const groupInvite = groupStatus?.pendingInvites?.[0] ?? null;
  const groupInviteCount = groupStatus?.pendingInvites?.length ?? 0;
  const entitled = hasPlanAccess(profile);
  const personalSystems = catalog.systems.filter((s) => s.access_tier === "core");
  const householdSystems = catalog.systems.filter((s) => s.access_tier === "full");
  const isHousehold = viewing.kind === "household";
  const systems = (isHousehold ? householdSystems : personalSystems)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const startSystems = isHousehold ? systems : timedSystems(catalog.systems);
  const lane = readPrepLane();
  const continueLists = isHousehold
    ? systems
    : hasSurvivalVault
      ? [...startSystems, ...proSystems(catalog.systems)]
      : startSystems;

  const visibleItems = continueLists.flatMap((system) =>
    trackedItems(system, catalog.sections, catalog.items, customItems, lane),
  );
  const done = visibleItems.filter((item) => progress[item.id]?.checked).length;
  const pct = percent(done, visibleItems.length);
  const continueSystem = entitled ? findContinueSystem(continueLists, catalog, customItems, progress) : null;
  const checklistHeading = viewing.title === "Survival Vault" ? "My Checklist" : viewing.title;
  const placeLabel = locationDisplayLabel(localProfile.location);

  return (
    <div className="dash-home">
      {groupInvite && viewing.isOwn ? (
        <div className="home-group-invite" role="status">
          <p>
            <strong>
              {groupInviteCount > 1
                ? `You have ${groupInviteCount} Group Sharing invitations.`
                : `${groupInvite.hostName} invited you to ${groupInvite.groupName}.`}
            </strong>{" "}
            Review it to accept or decline — nothing is shared until you accept.
          </p>
          <Link className="btn btn-primary" to="/app/group-sharing">
            Review invitation
          </Link>
        </div>
      ) : null}
      {viewing.isOwn ? (
        <Link className="dash-identity" to="/app/profile" aria-label="Edit profile">
          <ProfileAvatar className="dash-avatar" name={viewing.ownerName === "My" ? null : viewing.ownerName} avatarUrl={viewing.avatarUrl} />
          <div>
            <p className="eyebrow dash-greeting">{greetingPhrase()}</p>
            <h1 className="dash-heading">{checklistHeading}</h1>
          </div>
        </Link>
      ) : (
        <div className="dash-identity">
          <ProfileAvatar className="dash-avatar" name={viewing.ownerName === "My" ? null : viewing.ownerName} avatarUrl={viewing.avatarUrl} />
          <div>
            <h1 className="dash-heading">{checklistHeading}</h1>
          </div>
        </div>
      )}

      <div className="readiness" data-onboarding="progress">
        <div className="readiness-photo" aria-hidden="true">
          <img src={PHOTO_LIBRARY.landscape} alt="" />
        </div>
        <div className="readiness-head">
          <div className="eyebrow">Checklist Progress</div>
          {placeLabel ? <p className="readiness-place">{placeLabel}</p> : null}
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
          We couldn’t confirm this purchase yet. If you just paid, give it a moment — or contact help if payment didn’t go through.
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

      <div className="system-list">
        {(isHousehold ? systems : startSystems).map((system) => (
          <SystemRow key={system.id} slug={system.slug} />
        ))}
      </div>
      {!isHousehold && hasSurvivalVault ? (
        <div style={{ marginTop: 28 }}>
          <p className="dash-section-title">Pro checklists</p>
          <div className="system-list" style={{ marginTop: 12 }}>
            {proSystems(catalog.systems).map((system) => (
              <SystemRow key={system.id} slug={system.slug} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const TIMED_SLUGS = ["grab-go", "ready-bag", "vehicle-suitcase", "home-resilience"];

export const PRO_SLUGS = ["off-grid", "water-purification", "battery-solar", "cooling-heat", "long-term-food"];

/** @deprecated Use PRO_SLUGS */
export const VAULT_SLUGS = PRO_SLUGS;

export function proSystems(systems: ChecklistSystem[]) {
  const bySlug = PRO_SLUGS.map((slug) => systems.find((system) => system.slug === slug)).filter(
    (system): system is ChecklistSystem => Boolean(system),
  );
  if (bySlug.length) return bySlug;
  // Fallback: any active full-tier list if slug catalog differs.
  return systems
    .filter((system) => system.access_tier === "full" && system.active !== false)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** @deprecated Use proSystems */
export function vaultSystems(systems: ChecklistSystem[]) {
  return proSystems(systems);
}

function timedSystems(systems: ChecklistSystem[]) {
  return TIMED_SLUGS.map((slug) => systems.find((system) => system.slug === slug)).filter((system): system is ChecklistSystem => Boolean(system));
}

export function ListsPage() {
  const { catalog, viewing, hasSurvivalVault } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const startSystems = timedSystems(catalog.systems);
  const extraSystems = hasSurvivalVault ? proSystems(catalog.systems) : [];
  const [imports, setImports] = useState<ImportedChecklist[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shared = params.get("import") || params.get("payload");
    if (shared) {
      navigate(`/import?import=${encodeURIComponent(shared)}`, { replace: true });
      return;
    }
  }, [location.search, navigate]);

  useEffect(() => {
    let live = true;
    void loadImportedLists().then((rows) => {
      if (live) setImports(rows.sort((a, b) => b.importedAt.localeCompare(a.importedAt)));
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div>
      <div className="lists-identity">
        <ProfileAvatar
          className="switcher-avatar"
          name={viewing.ownerName === "My" ? null : viewing.ownerName}
          avatarUrl={viewing.avatarUrl}
        />
        <h1 className="page-title">{viewing.title === "Survival Vault" ? "My Checklist" : viewing.title}</h1>
      </div>
      <div className="system-list">
        {startSystems.map((system) => (
          <SystemRow key={system.id} slug={system.slug} />
        ))}
      </div>
      {extraSystems.length ? (
        <div style={{ marginTop: 28 }}>
          <p className="dash-section-title">Pro checklists</p>
          <div className="system-list" style={{ marginTop: 12 }}>
            {extraSystems.map((system) => (
              <SystemRow key={system.id} slug={system.slug} />
            ))}
          </div>
        </div>
      ) : null}
      {imports.length ? (
        <div style={{ marginTop: 28 }}>
          <h2 className="page-title" style={{ fontSize: 22 }}>
            Shared copies
          </h2>
          <p className="muted">Lists someone shared with you — saved separately from your main checklists.</p>
          <div className="system-list" style={{ marginTop: 12 }}>
            {imports.map((row) => (
              <Link key={row.id} className="system-row" to={`/app/imports/${row.id}`}>
                <span>
                  <b>{row.title}</b>
                  <small className="muted">
                    {row.items.length} items
                    {row.sharedBy ? ` · from ${row.sharedBy}` : ""}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
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

export function SystemRow({ slug, copy }: { slug: string; copy?: { title: string; line: string; detail: string } }) {
  const { catalog, progress, profile, customItems, hasSurvivalVault, viewing } = useApp();
  const system = catalog.systems.find((s) => s.slug === slug);
  if (!system) return null;
  const lane = readPrepLane();
  const items = trackedItems(system, catalog.sections, catalog.items, customItems, lane);
  const done = items.filter((i) => progress[i.id]?.checked).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const noPlan = !isLicensed() && profile?.role !== "owner";
  const locked = noPlan || (system.access_tier === "full" && !hasSurvivalVault);
  const to =
    noPlan
      ? "/#pricing"
      : system.access_tier === "full" && !hasSurvivalVault
        ? "/app/license"
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
        <h3>{copy?.title || system.title}</h3>
        {copy ? (
          <>
            <p>{copy.line}</p>
            <p>{copy.detail}</p>
          </>
        ) : (
          <p>{system.description}</p>
        )}
        <div className="progress-meta">
          <span>
            {done} / {items.length} {isTimedSystem(system) ? "priority" : "complete"}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <Link className={`btn ${locked ? "btn-forest" : "btn-moss"}`} to={to}>
          {locked
            ? system.access_tier === "full"
              ? "Available with Pro"
              : "Unlock"
            : viewing.canEdit
              ? "Open list"
              : "View list"}
        </Link>
      </div>
    </article>
  );
}
