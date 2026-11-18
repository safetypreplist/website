import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useApp } from "./context/AppContext";
import { HomeV2Page } from "./pages/HomeV2";
import { CheckoutPage, PricingPage, ThankYouPage } from "./pages/Purchase";
import { AppSplash } from "./components/AppSplash";
import { ComingSoonOwnerPill, ComingSoonPage } from "./components/ComingSoon";
import { isOpenDuringComingSoon, useComingSoon } from "./lib/comingSoon";
import { analyticsStarted, enableAnalytics, trackContentsquarePage, trackPageView } from "./lib/analytics";
import { cookieChoice } from "./lib/legalConsent";
import { isLicensed } from "./lib/licenseClient";
import { CookieNotice } from "./components/CookieNotice";
import { PageMeta } from "./components/PageMeta";
import { ScrollToTop } from "./components/ScrollToTop";
import { SupportChat } from "./components/SupportChat";
import { PrivacyPage, TermsPage } from "./pages/Legal";
import { ContactPage } from "./pages/Contact";
import { DemoPage } from "./pages/Demo";
import { InstallPage } from "./pages/Install";
import { NotFoundPage } from "./pages/NotFound";
import { HelpPage } from "./pages/Help";
import { AdminPage } from "./pages/Admin";
import { ContactsPage } from "./pages/Contacts";
import { DashboardPage, ListsPage } from "./pages/Dashboard";
import { HouseholdPage } from "./pages/Survival";
import { SafetyPage } from "./pages/Safety";
import { SystemPage } from "./pages/System";
import { ActivatePage } from "./pages/Activate";
import { LicensePage } from "./pages/License";
import { ResetDevicesPage } from "./pages/ResetDevices";
import { ImportChecklistPage } from "./pages/ImportChecklist";
import { ImportedListPage } from "./pages/ImportedList";

function isInsideSystem(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

function Analytics() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;
  const lastPath = useRef<string | null>(null);
  const sawFirstScreen = useRef(false);

  useEffect(() => {
    if (cookieChoice() === "essential") return;
    if (!sawFirstScreen.current) {
      sawFirstScreen.current = true;
      return;
    }
    trackContentsquarePage();
  }, [path]);

  useEffect(() => {
    if (cookieChoice() !== "all") return;
    const first = !analyticsStarted();
    enableAnalytics();
    if (first) {
      lastPath.current = path;
      return;
    }
    if (lastPath.current === path) return;
    lastPath.current = path;
    trackPageView(path);
  }, [path]);

  return null;
}

function RequireLicense({ children }: { children: React.ReactNode }) {
  const { loading } = useApp();
  if (loading) return <AppSplash />;
  if (!isLicensed()) return <Navigate to="/activate" replace />;
  return <>{children}</>;
}

function LicensedApp({ children }: { children: React.ReactNode }) {
  return (
    <RequireLicense>
      <AppShell>{children}</AppShell>
    </RequireLicense>
  );
}

export default function App() {
  const { profile, loading } = useApp();
  const location = useLocation();
  const comingSoon = useComingSoon();
  const isOwner = profile?.role === "owner";
  const licensed = isLicensed();

  const insideSystem = isInsideSystem(location.pathname);

  if (!comingSoon.ready && insideSystem) return <AppSplash />;

  if (location.pathname === "/maintenance") {
    if (loading && insideSystem) return <AppSplash />;
    return isOwner ? (
      <ComingSoonPage eyebrow={comingSoon.eyebrow} title={comingSoon.title} message={comingSoon.message} preview />
    ) : (
      <Navigate to="/" replace />
    );
  }

  if (comingSoon.enabled) {
    if (loading && insideSystem) return <AppSplash />;
    if (!isOwner && !licensed && !isOpenDuringComingSoon(location.pathname)) {
      return <ComingSoonPage eyebrow={comingSoon.eyebrow} title={comingSoon.title} message={comingSoon.message} />;
    }
  }
  const showOwnerPill =
    comingSoon.enabled &&
    isOwner &&
    !location.pathname.startsWith("/app") &&
    !location.pathname.startsWith("/admin");

  return (
    <>
      {showOwnerPill ? <ComingSoonOwnerPill /> : null}
      <PageMeta />
      <ScrollToTop />
      <Analytics />
      <CookieNotice />
      <Routes>
        <Route path="/" element={<HomeV2Page />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/classic" element={<Navigate to="/" replace />} />
        <Route path="/launch26" element={<Navigate to="/#pricing" replace />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/activate" element={<ActivatePage />} />
        <Route path="/license" element={<LicensePage />} />
        <Route path="/import" element={<ImportChecklistPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/support" element={<Navigate to="/contact" replace />} />
        <Route path="/refunds" element={<Navigate to="/terms#refunds" replace />} />
        <Route path="/app/reset-devices" element={<ResetDevicesPage />} />
        <Route
          path="/app"
          element={
            <LicensedApp>
              <DashboardPage />
            </LicensedApp>
          }
        />
        <Route
          path="/app/lists"
          element={
            <LicensedApp>
              <ListsPage />
            </LicensedApp>
          }
        />
        <Route
          path="/app/lists/:slug"
          element={
            <LicensedApp>
              <SystemPage />
            </LicensedApp>
          }
        />
        <Route
          path="/app/imports/:id"
          element={
            <LicensedApp>
              <ImportedListPage />
            </LicensedApp>
          }
        />
        <Route
          path="/app/contacts"
          element={
            <LicensedApp>
              <ContactsPage />
            </LicensedApp>
          }
        />
        <Route
          path="/app/safety"
          element={
            <LicensedApp>
              <SafetyPage />
            </LicensedApp>
          }
        />
        <Route
          path="/app/help"
          element={
            <LicensedApp>
              <HelpPage />
            </LicensedApp>
          }
        />
        <Route path="/app/household" element={<Navigate to="/app/survival" replace />} />
        <Route path="/app/vault" element={<Navigate to="/app/survival" replace />} />
        <Route path="/app/survival/videos" element={<Navigate to="/app/survival" replace />} />
        <Route
          path="/app/survival"
          element={
            <LicensedApp>
              <HouseholdPage />
            </LicensedApp>
          }
        />
        <Route
          path="/admin"
          element={
            <LicensedApp>
              <AdminPage />
            </LicensedApp>
          }
        />
        <Route path="/signin" element={<Navigate to="/activate" replace />} />
        <Route path="/create-account" element={<Navigate to="/activate" replace />} />
        <Route path="/join" element={<Navigate to="/activate" replace />} />
        <Route path="/invite/:token" element={<Navigate to="/activate" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <SupportChat />
    </>
  );
}
