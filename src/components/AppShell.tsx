import { Link, NavLink, useLocation } from "react-router-dom";
import { BrandMark } from "./Brand";
import { HeaderClock } from "./LocationStatus";
import { SidebarWeather } from "./SidebarWeather";
import { useApp } from "../context/AppContext";
import { LegalNotices } from "./LegalNotices";
import { OnboardingTour } from "./OnboardingTour";
import { AppStatusBanners } from "./OfflineStatus";
import { isProLicense } from "../lib/licenseClient";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { hasSurvivalVault, localProfile } = useApp();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const pro = hasSurvivalVault || isProLicense();
  const avatar = localProfile.avatarDataUrl;

  return (
    <div className={`app-shell${isAdminRoute ? " admin-console-shell" : ""}`}>
      <header className="app-top">
        <div className="brand">
          <BrandMark />
          <div className="titles">
            <small>Preparedness</small>
            <b>Safety Prep List</b>
          </div>
        </div>
        <div className="app-top-end">
          <HeaderClock />
          {avatar ? (
            <NavLink className="header-avatar" to="/app/profile" aria-label="Profile">
              <img src={avatar} alt="" />
            </NavLink>
          ) : null}
        </div>
      </header>
      <nav className="desktop-sidebar" aria-label="Main">
        <NavLink to="/app" end className={({ isActive }) => (isActive ? "active" : "")}>
          Home
        </NavLink>
        <NavLink data-onboarding="my-checklist" to="/app/lists" className={({ isActive }) => (isActive ? "active" : "")}>
          My Checklist
        </NavLink>
        <NavLink to="/app/contacts" className={({ isActive }) => (isActive ? "active" : "")}>
          Emergency Contacts
        </NavLink>
        <NavLink to="/app/safety" className={({ isActive }) => (isActive ? "active" : "")}>
          Safety Resources
        </NavLink>
        <NavLink to="/app/profile" className={({ isActive }) => (isActive ? "active" : "")}>
          Profile
        </NavLink>
        {!pro ? (
          <Link className="nav-upgrade" data-onboarding="upgrade-pro" to="/app/license">
            Upgrade to Pro
          </Link>
        ) : null}
        <p className="sidebar-label">License</p>
        <NavLink data-onboarding="license" to="/app/license" className={({ isActive }) => (isActive ? "active" : "")}>
          My license
        </NavLink>
        <NavLink to="/app/transfer" className={({ isActive }) => (isActive ? "active" : "")}>
          Transfer / Deactivate
        </NavLink>
        <NavLink to="/app/help" className={({ isActive }) => (isActive ? "active" : "")}>
          Help
        </NavLink>
        {!isAdminRoute ? <SidebarWeather /> : null}
      </nav>
      <main className="app-main">
        {!isAdminRoute ? <AppStatusBanners /> : null}
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
        <NavLink data-onboarding="license" to="/app/license">
          <KeyIcon />
          License
        </NavLink>
      </nav>
      <LegalNotices />
      <OnboardingTour />
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
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="14" r="3" />
      <path d="M10.5 12.5 20 3m-5 1 2 2" />
    </svg>
  );
}
