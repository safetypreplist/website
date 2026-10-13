import { useState } from "react";
import {
  INSTALL_URL_LABEL,
  detectPlatform,
  isInstalledApp,
  isPhoneOrTablet,
  promptInstall,
  useInstallPrompt,
  type InstallPlatform,
} from "../lib/install";

const GUIDES: { id: InstallPlatform; label: string; steps: string[]; note?: string }[] = [
  {
    id: "ios-safari",
    label: "iPhone or iPad (Safari)",
    steps: [
      "Tap the Share button (the square with an arrow) in Safari.",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add, then open Safety Prep List from your Home Screen.",
    ],
    note: "On iPhone and iPad, the Home Screen app keeps its own storage, separate from Safari. Sign in and prepare offline use inside the Home Screen app, and use it instead of Safari, because each one counts as a device.",
  },
  {
    id: "ios-other",
    label: "iPhone or iPad (Chrome or another browser)",
    steps: [
      "Tap the Share button in your browser.",
      "Tap Add to Home Screen. If you do not see it, open " + INSTALL_URL_LABEL + " in Safari instead.",
      "Open Safety Prep List from your Home Screen.",
    ],
    note: "The Home Screen app keeps its own storage. Sign in and prepare offline use inside it, and use it instead of the browser, because each one counts as a device.",
  },
  {
    id: "android",
    label: "Android phone or tablet",
    steps: [
      "In Chrome, tap the menu (three dots) in the top corner.",
      "Tap Install app or Add to Home screen.",
      "Open Safety Prep List from your Home screen or app list.",
    ],
  },
  {
    id: "desktop-chromium",
    label: "Computer (Chrome or Edge)",
    steps: [
      "Click the install icon at the right end of the address bar.",
      "Or open the browser menu and choose Install Safety Prep List (in Edge: Apps, then Install this site as an app).",
    ],
  },
  {
    id: "mac-safari",
    label: "Mac (Safari)",
    steps: ["In the menu bar, choose File, then Add to Dock."],
  },
  {
    id: "desktop-firefox",
    label: "Computer (Firefox)",
    steps: [
      "Firefox on computers does not install web apps. Bookmark this site, or use Chrome, Edge, or Safari to install it.",
    ],
  },
];

export function InstallSteps({ compact = false }: { compact?: boolean }) {
  const [platform] = useState(detectPlatform);
  const [installed] = useState(isInstalledApp);
  const { canPrompt, justInstalled } = useInstallPrompt();
  const [outcome, setOutcome] = useState<"accepted" | "dismissed" | "unavailable" | null>(null);
  const [showAll, setShowAll] = useState(false);
  const guide = GUIDES.find((item) => item.id === platform);
  const others = GUIDES.filter((item) => item.id !== guide?.id);

  if (installed) {
    return (
      <div className="install-steps">
        <p className="install-done" role="status">
          You are using the installed Safety Prep List app on this device.
        </p>
      </div>
    );
  }

  return (
    <div className={`install-steps${compact ? " compact" : ""}`}>
      {justInstalled || outcome === "accepted" ? (
        <p className="install-done" role="status">
          Installed. Open Safety Prep List from your {isPhoneOrTablet(platform) ? "Home Screen" : "apps"}, sign in, and
          prepare it for offline use there.
        </p>
      ) : canPrompt ? (
        <div className="install-prompt">
          <button
            className="btn btn-primary"
            type="button"
            onClick={async () => setOutcome(await promptInstall())}
          >
            Install Safety Prep List
          </button>
          {outcome === "dismissed" ? <small className="muted">You can install it any time from this page.</small> : null}
        </div>
      ) : null}

      {guide && !(justInstalled || outcome === "accepted") ? (
        <div className="install-guide">
          <h3>{guide.label}</h3>
          <ol>
            {guide.steps.map((stepText) => (
              <li key={stepText}>{stepText}</li>
            ))}
          </ol>
          {guide.note ? <p className="install-note">{guide.note}</p> : null}
        </div>
      ) : null}

      <button className="install-more" type="button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
        {showAll ? "Hide other devices" : guide ? "Using a different device?" : "Show install steps for each device"}
      </button>
      {showAll ? (
        <div className="install-guide-list">
          {others.map((item) => (
            <div className="install-guide" key={item.id}>
              <h3>{item.label}</h3>
              <ol>
                {item.steps.map((stepText) => (
                  <li key={stepText}>{stepText}</li>
                ))}
              </ol>
              {item.note ? <p className="install-note">{item.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function InstallQr({ caption = "Setting up a phone or tablet?" }: { caption?: string }) {
  return (
    <figure className="install-qr">
      <img src="/images/install-qr.svg" width={148} height={148} alt={`QR code that opens ${INSTALL_URL_LABEL}`} />
      <figcaption>
        <strong>{caption}</strong>
        <span>
          Scan this code with its camera, or go to <b>{INSTALL_URL_LABEL}</b>.
        </span>
      </figcaption>
    </figure>
  );
}
