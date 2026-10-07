import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { isOnboardingPreview } from "./components/OnboardingTour";
import { useApp } from "./context/AppContext";
import { LandingPage } from "./pages/Landing";
import { Launch26Page } from "./pages/Launch26";
import { CreateAccountPage, ResetPasswordPage, SignInPage, UpdatePasswordPage } from "./pages/Auth";
import { CheckoutPage, PricingPage, ThankYouPage } from "./pages/Purchase";
import { CookieNotice } from "./components/CookieNotice";
import { PrivacyPage, RefundsPage, SupportPage, TermsPage } from "./pages/Legal";
import { AccountPage, VaultPage } from "./pages/Account";
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useApp();
  const location = useLocation();
  if (loading) return <p className="wrap" style={{ padding: 40 }}>Loading…</p>;
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function DeviceGate({ children }: { children: React.ReactNode }) {
  const { deviceLimitReached } = useApp();
  const location = useLocation();
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
  return (
    <>
    <CookieNotice />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/launch26" element={<Launch26Page />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/thank-you" element={<ThankYouPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/refunds" element={<RefundsPage />} />
      <Route path="/support" element={<SupportPage />} />
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
      <Route path="/app/vault" element={<Navigate to="/app/survival/videos" replace />} />
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
        path="/app/survival/videos"
        element={
          <RequireAuth>
            <DeviceGate>
              <AppShell>
                <VaultPage />
              </AppShell>
            </DeviceGate>
          </RequireAuth>
        }
      />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
