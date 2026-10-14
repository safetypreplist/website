import { useState, type CSSProperties } from "react";
import { FOOTER_TAGLINE } from "../lib/copy";

/** Same markup as the splash in index.html, so the hand-off from the page shell to the app is seamless. */
export function AppSplash() {
  const [elapsed] = useState(() => performance.now());
  return (
    <div
      className="app-splash"
      role="status"
      aria-label="Loading Safety Prep List"
      style={{ animation: "none", "--app-splash-offset": `-${Math.round(elapsed % 1400)}ms` } as CSSProperties}
    >
      <img
        className="app-splash-icon"
        src="/icons/icon-192.png?v=3"
        width={96}
        height={96}
        alt=""
        style={{ animationDelay: `-${Math.round(elapsed % 2800)}ms` }}
      />
      <p className="app-splash-name">Safety Prep List</p>
      <p className="app-splash-tagline">{FOOTER_TAGLINE}</p>
      <div className="app-splash-bar" aria-hidden="true" />
    </div>
  );
}
