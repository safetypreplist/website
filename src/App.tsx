import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { isOnboardingPreview } from "./components/OnboardingTour";
import { useApp } from "./context/AppContext";
import { LandingPage } from "./pages/Landing";
import { HomeV2Page } from "./pages/HomeV2";
import { CreateAccountPage, JoinFamilyPage, ResetPasswordPage, SignInPage, UpdatePasswordPage } from "./pages/Auth";
import { CheckoutPage, PricingPage, ThankYouPage } from "./pages/Purchase";
import { AppSplash } from "./components/AppSplash";
import { ComingSoonOwnerPill, ComingSoonPage } from "./components/ComingSoon";
import { isOpenDuringComingSoon, useComingSoon } from "./lib/comingSoon";
import { analyticsStarted, enableAnalytics, trackContentsquarePage, trackPageView } from "./lib/analytics";
import { cookieChoice } from "./lib/legalConsent";
import { CookieNotice } from "./components/CookieNotice";
import { PageMeta } from "./components/PageMeta";
import { ScrollToTop } from "./components/ScrollToTop";
import { SupportChat } from "./components/SupportChat";
import { PrivacyPage, TermsPage } from "./pages/Legal";
import { ContactPage } from "./pages/Contact";
import { DemoPage } from "./pages/Demo";
import { InstallPage } from "./pages/Install";
import { NotFoundPage } from "./pages/NotFound";
import { AccessEndedPage } from "./pages/AccessEnded";
import { AccountPage } from "./pages/Account";
import { BillingPage, ReceiptPage } from "./pages/Billing";
import { HelpPage } from "./pages/Help";
import { AdminPage } from "./pages/Admin";
import { ContactsPage } from "./pages/Contacts";
import { DashboardPage, ListsPage } from "./pages/Dashboard";
import { DevicesPage } from "./pages/Devices";
import {
  ChecklistAccessPage,
  ConnectedChecklistsPage,
  HouseholdPage,
  ManageFamilyPage,
} from "./pages/Family";
import { SafetyPage } from "./pages/Safety";
import { SystemPage } from "./pages/System";

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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useApp();
  const location = useLocation();
  if (loading) return <AppSplash />;
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function DeviceGate({ children }: { children: React.ReactNode }) {
  const { deviceLimitReached, accessMode } = useApp();
  const location = useLocation();
  if (accessMode === "locked" && !isOnboardingPreview()) {
    return <Navigate to="/app/renew" replace />;
  }
  if (
    deviceLimitReached &&
    !isOnboardingPreview() &&
    !location.pathname.startsWith("/app/devices") &&
    !location.pathname.startsWith("/app/account") &&
    !location.pathname.startsWith("/app/help")
  ) {
    return <Navigate to="/app/devices" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { session, profile, loading } = useApp();
  const location = useLocation();
  const comingSoon = useComingSoon();
  const isOwner = profile?.role === "owner";

  const insideSystem = isInsideSystem(location.pathname);

  // Inside the app, wait behind the branded splash. On the public site, paint the page
  // immediately so the homepage is not covered by the loader.
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
    // Signed-in accounts keep working, so existing members are never locked out. The owner sees everything.
    if (!isOwner && !session && !isOpenDuringComingSoon(location.pathname)) {
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
      <Route path="/classic" element={<LandingPage />} />
      <Route path="/launch26" element={<Navigate to="/#pricing" replace />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/thank-you" element={<ThankYouPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/join" element={<JoinFamilyPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/support" element={<Navigate to="/contact" replace />} />
      <Route path="/refunds" element={<Navigate to="/terms#refunds" replace />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/lists"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <ListsPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/lists/:slug"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <SystemPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/contacts"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <ContactsPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/safety"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <SafetyPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/account"
        element={
          <RequireAuth>
            <AppShell>
              <AccountPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/billing"
        element={
          <RequireAuth>
            <AppShell>
              <BillingPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/billing/receipt/:id"
        element={
          <RequireAuth>
            <AppShell>
              <ReceiptPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/renew"
        element={
          <RequireAuth>
            <AppShell>
              <AccessEndedPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/help"
        element={
          <RequireAuth>
            <AppShell>
              <HelpPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/devices"
        element={
          <RequireAuth>
            <AppShell>
              <DevicesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/family"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <ManageFamilyPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/family/connected"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <ConnectedChecklistsPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/access"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <ChecklistAccessPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route path="/app/household" element={<Navigate to="/app/survival" replace />} />
      <Route path="/app/vault" element={<Navigate to="/app/survival" replace />} />
      <Route path="/app/survival/videos" element={<Navigate to="/app/survival" replace />} />
      <Route
        path="/app/survival"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <HouseholdPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
      <Route path="/invite/:token" element={<Navigate to="/create-account" replace />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AppShell>
              <AdminPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <SupportChat />
    </>
  );
}
