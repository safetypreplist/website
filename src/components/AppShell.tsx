import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./Brand";
import { HeaderClock, SidebarWeather } from "./LocationStatus";
import { useApp } from "../context/AppContext";
import { checklistTitle, initialsFrom } from "../lib/identity";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, profile, user, viewing, hasSurvivalVault, switchChecklist, myChecklist } = useApp();
  const location = useLocation();
  const initial = initialsFrom(profile?.full_name || viewing.ownerName, user?.email);
  const vaultActive = location.pathname.startsWith("/app/survival");

  useEffect(() => {
    const onPersonalHome = location.pathname === "/app" || location.pathname === "/app/lists";
    if (onPersonalHome && viewing.kind === "household") {
      void switchChecklist("personal", myChecklist?.id ?? null);
    }
  }, [location.pathname, viewing.kind, myChecklist?.id, switchChecklist]);

  return (
    <div className="app-shell">
      <header className="app-top">
        <div className="brand">
          <BrandMark />
          <div className="titles">
            <small>Preparedness</small>
            <b>Safety Prep List</b>
          </div>
        </div>
        <ChecklistSwitcher className="mobile-switcher" />
        <div className="app-top-end">
          <HeaderClock />
          <NavLink className="header-avatar" to="/app/account" aria-label="Profile">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initial}</span>}
          </NavLink>
        </div>
      </header>
      <nav className="desktop-sidebar" aria-label="Main">
        <ChecklistSwitcher className="sidebar-switcher" />
        <NavLink to="/app" end className={({ isActive }) => (isActive ? "active" : "")}>
          Home
        </NavLink>
        <NavLink to="/app/lists" className={({ isActive }) => (isActive ? "active" : "")}>
          My Checklist
        </NavLink>
        <NavLink to="/app/contacts" className={({ isActive }) => (isActive ? "active" : "")}>
          Emergency Contacts
        </NavLink>
        <NavLink to="/app/safety" className={({ isActive }) => (isActive ? "active" : "")}>
          Safety Resources
        </NavLink>
        {hasSurvivalVault ? (
          <NavLink to="/app/survival" className={vaultActive ? "active" : ""}>
            Survival Vault
          </NavLink>
        ) : (
          <Link className="nav-upgrade" to="/app/account#addons">
            Survival Vault
          </Link>
        )}
        <p className="sidebar-label">Family</p>
        <NavLink to="/app/family" end className={({ isActive }) => (isActive ? "active" : "")}>
          Manage Family Plan
        </NavLink>
        <p className="sidebar-label">Account</p>
        <NavLink to="/app/account" className={({ isActive }) => (isActive ? "active" : "")}>
          Profile
        </NavLink>
        <NavLink to="/app/devices" className={({ isActive }) => (isActive ? "active" : "")}>
          My Devices
        </NavLink>
        <button className="btn btn-ghost sidebar-logout" type="button" onClick={() => void signOut()}>
          Log out
        </button>
        <SidebarWeather />
      </nav>
      <main className="app-main">
        {!viewing.isOwn && viewing.kind !== "household" && !viewing.canEdit ? <ViewingBanner /> : null}
        {children}
      </main>
      <nav className="bottom-nav" aria-label="Mobile">
        <NavLink to="/app" end>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/app/lists">
          <ListIcon />
          Checklist
        </NavLink>
        <NavLink to="/app/contacts">
          <PeopleIcon />
          Contacts
        </NavLink>
        <NavLink to="/app/safety">
          <ShieldIcon />
          Safety
        </NavLink>
        <NavLink to="/app/account">
          <UserIcon />
          Account
        </NavLink>
      </nav>
    </div>
  );
}

function ViewingBanner() {
  return (
    <div className="viewing-banner view">
      <span>View Only</span>
    </div>
  );
}

function ChecklistSwitcher({ className }: { className?: string }) {
  const { viewing, myChecklist, connectedChecklists, switchChecklist, profile } = useApp();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const mineName = myChecklist?.displayName || viewing.ownerName;
  const lists = [
    myChecklist
      ? { id: myChecklist.id, title: checklistTitle(mineName), avatarUrl: myChecklist.avatarUrl || profile?.avatar_url }
      : null,
    ...connectedChecklists
      .filter((c) => !c.pending)
      .map((c) => ({ id: c.id, title: checklistTitle(c.displayName), avatarUrl: c.avatarUrl })),
  ].filter((row): row is { id: string; title: string; avatarUrl: string | null | undefined } => Boolean(row));
  const activeId = viewing.kind === "personal" ? viewing.checklistId : myChecklist?.id;
  const active = lists.find((row) => row.id === activeId) || lists[0];
  const label = active?.title || viewing.title;
  const avatar = active?.avatarUrl || profile?.avatar_url;

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function choose(id: string) {
    await switchChecklist("personal", id);
    setOpen(false);
    navigate("/app");
  }

  return (
    <div className={`checklist-switcher ${className || ""}`} ref={wrap}>
      <button
        className="checklist-switcher-btn"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch checklist"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="switcher-avatar">
          {avatar ? <img src={avatar} alt="" /> : <span>{initialsFrom(label)}</span>}
        </span>
        <span className="switcher-copy">
          <small>Switch Checklist</small>
          <b>{label}</b>
        </span>
        <span className="switcher-caret" aria-hidden="true">
          ▼
        </span>
      </button>
      {open ? (
        <div className="checklist-switcher-menu" role="listbox" aria-label="Checklists">
          {lists.map((row) => {
            const selected = row.id === activeId;
            return (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => void choose(row.id)}
              >
                <span>{row.title}</span>
                {selected ? <span className="checklist-switcher-check" aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11.5 12 4l8 7.5V20H4Z" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.8-3 3-5 6-5s5.2 2 6 5" />
      <circle cx="17" cy="9" r="2" />
      <path d="M17 14c2.2.3 3.8 1.8 4.5 4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 20 7v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7Z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.5 3.8-5.5 7-5.5s5.8 2 7 5.5" />
    </svg>
  );
}
