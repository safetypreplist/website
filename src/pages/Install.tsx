import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { InstallQr, InstallSteps } from "../components/InstallSteps";
import { PrepareOfflineCard } from "../components/OfflineStatus";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { useApp } from "../context/AppContext";
import { detectPlatform, isInstalledApp, isPhoneOrTablet } from "../lib/install";

export function InstallPage() {
  const { session, profile } = useApp();
  const [platform] = useState(detectPlatform);
  const signedIn = Boolean(session && profile);
  const entitled = Boolean(profile && profile.plan !== "none");
  const onPhone = isPhoneOrTablet(platform);

  if (isInstalledApp()) return <Navigate to="/app" replace />;

  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page install-page">
          <div className="install-hero">
            <img src="/icons/icon-192.png" width={72} height={72} alt="" />
            <div>
              <p className="eyebrow">Install</p>
              <h1>Get the Safety Prep List app</h1>
            </div>
          </div>
          <p>
            Install it right from this page in a few taps. It adds an icon to your {onPhone ? "Home Screen" : "computer"}{" "}
            and opens like an app. No App Store or Google Play download is needed.
          </p>

          <InstallSteps />

          <h2>Then get ready for offline use</h2>
          <ol className="install-checklist">
            <li>
              <b>Open Safety Prep List and sign in.</b>{" "}
              {signedIn ? "You are signed in on this device." : "Use the email and password for your account."}
            </li>
            <li>
              <b>Prepare your checklists for offline use.</b> On the Home page, choose Prepare for offline use. Do this
              while you are connected to the internet.
            </li>
            <li>
              <b>Reconnect now and then.</b> Open the app while connected so your changes sync and your access stays
              current.
            </li>
            <li>
              <b>Print a backup.</b> Print your most important checklists and keep a copy with your emergency supplies.
            </li>
          </ol>

          {signedIn && entitled ? (
            <PrepareOfflineCard compact />
          ) : (
            <div className="install-actions">
              <Link className="btn btn-primary" to={signedIn ? "/app" : "/signin"}>
                {signedIn ? "Open Safety Prep List" : "Sign in"}
              </Link>
            </div>
          )}

          <p className="install-fineprint">
            Offline, you can open the checklists saved on this device and check items off. Videos, purchases, family
            invitations, and other account changes need an internet connection.
          </p>

          {!onPhone ? <InstallQr caption="Setting up your phone or tablet?" /> : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
