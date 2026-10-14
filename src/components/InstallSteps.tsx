import { useState, type ReactNode } from "react";
import {
  INSTALL_URL,
  INSTALL_URL_LABEL,
  detectPlatform,
  isInstalledApp,
  isPhoneOrTablet,
  promptInstall,
  useInstallPrompt,
  type InstallPlatform,
} from "../lib/install";

function ShareIcon() {
  return (
    <svg className="install-icon" viewBox="0 0 24 24" aria-label="Share" role="img">
      <path d="M12 3v11M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg className="install-icon" viewBox="0 0 24 24" aria-label="Add" role="img">
      <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.5v7M8.5 12h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon({ vertical = false }: { vertical?: boolean }) {
  const dots = vertical ? [6, 12, 18].map((y) => [12, y]) : [6, 12, 18].map((x) => [x, 12]);
  return (
    <svg className="install-icon" viewBox="0 0 24 24" aria-label="Menu" role="img">
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="currentColor" />
      ))}
    </svg>
  );
}

type Guide = { id: InstallPlatform; label: string; steps: ReactNode[]; note?: string };

const GUIDES: Guide[] = [
  {
    id: "ios-safari",
    label: "iPhone or iPad (Safari)",
    steps: [
      <>
        Tap <ShareIcon /> <b>Share</b> at the bottom of Safari (top right on iPad). On newer iPhones, tap <MoreIcon />{" "}
        first, then <b>Share</b>.
      </>,
      <>
        Scroll down and tap <AddIcon /> <b>Add to Home Screen</b>. If you don’t see it, tap <b>View More</b>.
      </>,
      <>
        Tap <b>Add</b>. Then open <b>Safety Prep List</b> from your Home Screen and sign in.
      </>,
    ],
    note: "From then on, open Safety Prep List from the icon instead of Safari.",
  },
  {
    id: "ios-other",
    label: "iPhone or iPad (Chrome or another browser)",
    steps: [
      <>
        Tap <ShareIcon /> <b>Share</b>. In Chrome it’s in the address bar; in Firefox or Edge, open the menu first.
      </>,
      <>
        Tap <AddIcon /> <b>Add to Home Screen</b>. If you don’t see it, open {INSTALL_URL_LABEL} in Safari instead.
      </>,
      <>
        Open <b>Safety Prep List</b> from your Home Screen and sign in.
      </>,
    ],
    note: "From then on, open Safety Prep List from the icon instead of the browser.",
  },
  {
    id: "android",
    label: "Android phone or tablet",
    steps: [
      <>
        In Chrome, tap <MoreIcon vertical /> in the top corner.
      </>,
      <>
        Tap <b>Install app</b> (or <b>Add to Home screen</b>, then <b>Install</b>).
      </>,
      <>
        Open <b>Safety Prep List</b> from your Home screen and sign in.
      </>,
    ],
    note: "Opened this from a QR scanner? Tap Open in Chrome first.",
  },
  {
    id: "in-app",
    label: "Open this page in your browser first",
    steps: [
      <>
        This page opened inside another app, which can’t install apps. Tap <MoreIcon /> or <ShareIcon /> in this app.
      </>,
      <>
        Choose <b>Open in Safari</b> (iPhone) or <b>Open in Chrome</b> (Android). Or copy the link below and paste it
        there.
      </>,
      <>Follow the install steps on that page.</>,
    ],
  },
  {
    id: "desktop-chromium",
    label: "Computer (Chrome or Edge)",
    steps: [
      <>Click the install icon at the right end of the address bar.</>,
      <>
        Or open the browser menu and choose <b>Install Safety Prep List</b> (in Edge: Apps, then Install this site as an
        app).
      </>,
    ],
  },
  {
    id: "mac-safari",
    label: "Mac (Safari)",
    steps: [
      <>
        In the menu bar, choose <b>File</b>, then <b>Add to Dock</b>.
      </>,
    ],
  },
  {
    id: "desktop-firefox",
    label: "Computer (Firefox)",
    steps: [
      <>Firefox on computers does not install web apps. Bookmark this site, or use Chrome, Edge, or Safari to install it.</>,
    ],
  },
];

function GuideCard({ guide }: { guide: Guide }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="install-guide">
      <h3>{guide.label}</h3>
      <ol className="install-guide-steps">
        {guide.steps.map((stepText, index) => (
          <li key={index}>{stepText}</li>
        ))}
      </ol>
      {guide.id === "in-app" ? (
        <button
          className="btn btn-ghost install-copy"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(INSTALL_URL);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Link copied" : `Copy link: ${INSTALL_URL_LABEL}`}
        </button>
      ) : null}
      {guide.note ? <p className="install-note">{guide.note}</p> : null}
    </div>
  );
}

export function InstallSteps({ compact = false }: { compact?: boolean }) {
  const [platform] = useState(detectPlatform);
  const [installed] = useState(isInstalledApp);
  const { canPrompt, justInstalled } = useInstallPrompt();
  const [outcome, setOutcome] = useState<"accepted" | "dismissed" | "unavailable" | null>(null);
  const guide = GUIDES.find((item) => item.id === platform);
  const done = justInstalled || outcome === "accepted";
  const onPhone = isPhoneOrTablet(platform);

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
      {done ? (
        <p className="install-done" role="status">
          Added. Open Safety Prep List from your {onPhone ? "Home Screen" : "apps"} and sign in.
        </p>
      ) : canPrompt ? (
        <div className="install-prompt">
          <button
            className="btn btn-primary install-now"
            type="button"
            onClick={async () => setOutcome(await promptInstall())}
          >
            {onPhone ? "Add to Home Screen" : "Install Safety Prep List"}
          </button>
          <small className="muted">
            {outcome === "dismissed"
              ? "You can install it any time from this page."
              : `One tap adds Safety Prep List to your ${onPhone ? "Home screen" : "computer"}.`}
          </small>
        </div>
      ) : null}

      {guide && !done && !canPrompt ? <GuideCard guide={guide} /> : null}
    </div>
  );
}

/** A single row for onboarding: how to put the app icon on this phone, or a QR code when on a computer. */
export function AppIconRow() {
  const [platform] = useState(detectPlatform);
  const [installed] = useState(isInstalledApp);
  const { canPrompt, justInstalled } = useInstallPrompt();
  const [outcome, setOutcome] = useState<"accepted" | "dismissed" | "unavailable" | null>(null);
  if (installed) return null;

  const onPhone = isPhoneOrTablet(platform);
  const done = justInstalled || outcome === "accepted";

  if (!onPhone) {
    return (
      <div className="app-icon-row is-qr">
        <img className="app-icon-qr" src="/images/install-qr.svg" width={92} height={92} alt={`QR code that opens ${INSTALL_URL_LABEL}`} />
        <div className="offline-switch-text">
          <b>Put it on your phone</b>
          <span>Scan this with your phone’s camera to add the Safety Prep List icon to your Home Screen.</span>
        </div>
      </div>
    );
  }

  const hint: ReactNode = done
    ? "Added. Look for the Safety Prep List icon on your Home Screen."
    : canPrompt
      ? "One tap puts the icon on your Home Screen."
      : platform === "ios-safari" || platform === "ios-other"
        ? <>Tap <ShareIcon /> <b>Share</b>, then <AddIcon /> <b>Add to Home Screen</b>.</>
        : platform === "android"
          ? <>In Chrome, tap <MoreIcon vertical />, then <b>Install app</b>.</>
          : "Open this page in Safari or Chrome to add the icon.";

  return (
    <div className="app-icon-row">
      <img className="app-icon-img" src="/icons/icon-192.png" width={48} height={48} alt="" />
      <div className="offline-switch-text">
        <b>App icon on your phone</b>
        <span>{hint}</span>
        {canPrompt && !done ? (
          <button className="btn btn-primary app-icon-add" type="button" onClick={async () => setOutcome(await promptInstall())}>
            Add to Home Screen
          </button>
        ) : null}
      </div>
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
