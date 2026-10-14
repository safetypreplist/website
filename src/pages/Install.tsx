import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { InstallQr, InstallSteps } from "../components/InstallSteps";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { useApp } from "../context/AppContext";
import { detectPlatform, deviceName, isInstalledApp, isPhoneOrTablet } from "../lib/install";

export function InstallPage() {
  const { session, profile } = useApp();
  const [platform] = useState(detectPlatform);
  const signedIn = Boolean(session && profile);
  const onPhone = isPhoneOrTablet(platform);

  if (isInstalledApp()) return <Navigate to="/app" replace />;

  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page install-page">
          <div className="install-hero">
            <img src="/icons/icon-192.png?v=3" width={72} height={72} alt="" />
            <div>
              <p className="eyebrow">Safety Prep List</p>
              <h1>Add the app icon to your {deviceName(platform)}</h1>
            </div>
          </div>
          <p>It opens straight to your checklist, and it works offline. Nothing to download from an app store.</p>

          <InstallSteps />

          <div className="install-actions">
            <Link className="btn btn-ghost" to={signedIn ? "/app" : "/signin"}>
              {signedIn ? "Open my checklist" : "Sign in"}
            </Link>
          </div>

          {!onPhone ? <InstallQr caption="Want it on your phone?" /> : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
