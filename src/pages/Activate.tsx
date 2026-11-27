import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ActivateQrDialog, ActivateQrInline, usePhoneLike } from "../components/ActivateQrDialog";
import { BrandMark } from "../components/Brand";
import { markOnboardingSeen } from "../components/OnboardingTour";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { activate, getLicense, isLicensed, movedLicenseKey, takeActivateMessage } from "../lib/licenseClient";
import {
  describeSummary,
  findBackupToRestore,
  formatExpiry,
  isDeviceTakenError,
  keyFromLocation,
  looksLikeLicenseKey,
  moveLinkForKey,
  requestMoveByEmail,
  timeAgo,
  type FoundBackup,
  type MoveOutcome,
} from "../lib/moveLicense";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  downloadTransferBackupFile,
  hasLocalPersonalData,
  restoreTransferBackup,
  type TransferBackupPayload,
} from "../lib/transferBackup";

/** Router state other pages hand to Activate (never read from the URL, so a link can't trigger it). */
export type ActivateRouteState = {
  /** Old device just let go of the license: show where to go next. */
  movedOut?: MoveOutcome;
  /** Activate this key right away (email link confirmed on this device, or "use it here again"). */
  autoActivateKey?: string;
};

type View = "form" | "taken" | "emailSent" | "checkingBackup" | "restore" | "movedOut";

function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="checkout-stage license-gate">
      <div
        className="checkout-bg license-gate-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <main className="license-gate-shell">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function ActivatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || {}) as ActivateRouteState;
  const phoneLike = usePhoneLike();
  const existing = getLicense();
  const [reason] = useState(() => new URLSearchParams(location.search).get("reason") || "");
  const [incomingKey] = useState(
    () =>
      keyFromLocation(location.search, location.hash) ||
      routeState.autoActivateKey ||
      routeState.movedOut?.key ||
      (reason === "moved" ? movedLicenseKey() : ""),
  );
  const switchingKey = Boolean(
    incomingKey && existing && incomingKey.toUpperCase() !== existing.key.toUpperCase() && !routeState.movedOut,
  );

  const [key, setKey] = useState(incomingKey || existing?.key || "");
  const [view, setView] = useState<View>(() => {
    if (routeState.movedOut) return "movedOut";
    if (routeState.autoActivateKey) return "checkingBackup";
    if (reason === "moved" && incomingKey) return "taken";
    return "form";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPhoneQr, setShowPhoneQr] = useState(false);
  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [found, setFound] = useState<FoundBackup | null>(null);
  const [replacesLocal, setReplacesLocal] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [savedCopy, setSavedCopy] = useState(false);
  const autoStarted = useRef(false);

  // Keys never stay in the address bar (or history) once read.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasHashKey = new URLSearchParams(location.hash.replace(/^#/, "")).has("key");
    if (!params.has("key") && !hasHashKey) return;
    params.delete("key");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: "" }, { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = takeActivateMessage();
    if (stored) {
      setNotice(stored);
      return;
    }
    if (reason === "deactivated") {
      setNotice("This device is no longer activated. Enter your license key to activate it again.");
    } else if (reason === "moved") {
      setNotice("Your license moved to another device. Enter your key to see how to bring it back here.");
    }
  }, [reason]);

  useEffect(() => {
    if (view !== "taken" || reason !== "moved") return;
    void hasLocalPersonalData()
      .then(setHasLocalData)
      .catch(() => setHasLocalData(false));
  }, [view, reason]);

  async function activateHere(value: string) {
    setBusy(true);
    setError(null);
    try {
      const stored = await activate(value);
      setKey(stored.key);
      setView("checkingBackup");
      const backup = await findBackupToRestore(stored.key);
      if (!backup) {
        navigate("/app", { replace: true });
        return;
      }
      setReplacesLocal(await hasLocalPersonalData().catch(() => false));
      setFound(backup);
      setView("restore");
    } catch (err) {
      if (isDeviceTakenError(err)) {
        setView("taken");
      } else {
        setView("form");
        setError(err instanceof Error ? err.message : "Could not activate that license key.");
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!routeState.autoActivateKey || autoStarted.current) return;
    autoStarted.current = true;
    void activateHere(routeState.autoActivateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void activateHere(key);
  }

  async function emailMoveLink() {
    setBusy(true);
    setError(null);
    try {
      const sent = await requestMoveByEmail(key);
      setEmailMasked(sent.emailMasked);
      setView("emailSent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the email. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(payload: TransferBackupPayload) {
    setBusy(true);
    setError(null);
    try {
      await restoreTransferBackup(payload);
      markOnboardingSeen();
      navigate("/app", { replace: true });
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not restore that backup.");
    }
  }

  async function saveLocalCopy() {
    setError(null);
    try {
      await downloadTransferBackupFile();
      setSavedCopy(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save a backup file.");
    }
  }

  if (view === "movedOut" && routeState.movedOut) {
    return (
      <GateShell>
        <MovedOutPanel
          outcome={routeState.movedOut}
          phoneLike={phoneLike}
          busy={busy}
          error={error}
          onUseHere={() => void activateHere(routeState.movedOut!.key)}
          onShowQr={() => setShowPhoneQr(true)}
        />
        {showPhoneQr ? <ActivateQrDialog licenseKey={routeState.movedOut.key} onClose={() => setShowPhoneQr(false)} /> : null}
      </GateShell>
    );
  }

  if (view === "checkingBackup") {
    return (
      <GateShell>
        <section className="license-gate-panel" aria-busy="true">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">Activating</p>
          <h1>One moment…</h1>
          <p className="license-gate-lead">Activating this device and checking for your checklist backup.</p>
        </section>
      </GateShell>
    );
  }

  if (view === "restore" && found) {
    return (
      <GateShell>
        <section className="license-gate-panel">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">This device is activated</p>
          <h1>Restore your checklist?</h1>
          <p className="license-gate-lead">
            We found the backup from your other device, made {timeAgo(found.backup.createdAt)}:{" "}
            {describeSummary(found.summary)}.
          </p>
          {replacesLocal ? <p className="muted">This replaces what is on this device now.</p> : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="license-gate-form">
            <button
              className="btn btn-primary btn-block"
              type="button"
              disabled={busy}
              onClick={() => void restore(found.payload)}
            >
              {busy ? "Restoring…" : "Restore my checklist"}
            </button>
            <button
              className="btn btn-ghost btn-block"
              type="button"
              disabled={busy}
              onClick={() => navigate("/app", { replace: true })}
            >
              Start with an empty checklist
            </button>
          </div>
          <p className="license-gate-assurance">
            The backup stays available until {formatExpiry(found.backup.expiresAt)}.
          </p>
        </section>
      </GateShell>
    );
  }

  if (view === "emailSent") {
    return (
      <GateShell>
        <section className="license-gate-panel">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">Check your email</p>
          <h1>Open the link on this device</h1>
          <p className="license-gate-lead">
            {emailMasked
              ? `We sent a one-time link to ${emailMasked}.`
              : "If this license has an email on file, we sent a one-time link to it."}{" "}
            Open it here and your license moves to this device. It works once, for 24 hours.
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="license-gate-actions">
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void emailMoveLink()}>
              {busy ? "Sending…" : "Send it again"}
            </button>
          </div>
          <p className="muted license-move-aside">
            Opened the link on a different device?{" "}
            <button className="license-inline-link" type="button" disabled={busy} onClick={() => void activateHere(key)}>
              Activate here now
            </button>
          </p>
          <p className="license-gate-assurance">
            Nothing in your inbox or spam folder, or no access to that email? <Link to="/contact">Contact us</Link>.
          </p>
        </section>
      </GateShell>
    );
  }

  if (view === "taken") {
    const moved = reason === "moved";
    return (
      <GateShell>
        <section className="license-gate-panel">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">One device at a time</p>
          <h1>{moved ? "Your license moved to another device" : "This license is in use on another device"}</h1>
          <p className="license-gate-lead">
            {moved
              ? "This device can't open your checklist anymore. To use it here again, move it back:"
              : "To use it here, move it from that device:"}
          </p>

          <div className="license-move-choices">
            <article>
              <h2>I have that device</h2>
              <p>
                Open Safety Prep List on it and choose <strong>Move to a new device</strong>. It backs up your checklist
                and shows a code to scan with this device.
              </p>
            </article>
            <article>
              <h2>I can&apos;t use that device</h2>
              <p>We&apos;ll email a one-time link to the address on your purchase. Open it on this device to finish.</p>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={busy || !key.trim()}
                onClick={() => void emailMoveLink()}
              >
                {busy ? "Sending…" : "Email me a link"}
              </button>
            </article>
          </div>

          {moved && hasLocalData ? (
            <p className="muted license-move-aside">
              Want what&apos;s saved on this device?{" "}
              <button className="license-inline-link" type="button" onClick={() => void saveLocalCopy()}>
                Save it to a file
              </button>
            </p>
          ) : null}
          {savedCopy ? (
            <p className="license-gate-notice" role="status">
              Saved. On your other device, open Move to a new device and choose Restore from a file.
            </p>
          ) : null}
        </section>
        <p className="muted license-gate-foot">
          <button
            className="license-inline-link"
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setView("form");
            }}
          >
            Use a different key
          </button>
          {" · "}
          <Link to="/#pricing">Buy a license for this device</Link>
        </p>
      </GateShell>
    );
  }

  if (isLicensed() && existing && !switchingKey) {
    return (
      <GateShell>
        <section className="license-gate-panel">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">Ready on this device</p>
          <h1>Your license is active</h1>
          <p className="license-gate-lead">
            One license. One device. Lifetime access — ready offline whenever you need it.
          </p>
          <div className="license-gate-status">
            <div>
              <span>Plan</span>
              <strong>{existing.product === "pro" ? "Pro" : "Basic"}</strong>
            </div>
            <div>
              <span>License key</span>
              <code>{existing.key}</code>
            </div>
          </div>
          <div className="license-gate-actions">
            <Link className="btn btn-primary" to="/app">
              Open checklists
            </Link>
            <Link className="btn btn-ghost" to="/license">
              License details
            </Link>
          </div>
        </section>
        <aside className="license-transfer-card">
          <div>
            <p className="eyebrow">New phone or computer?</p>
            <p>Move your license and your checklist to it in about a minute.</p>
          </div>
          <Link className="btn btn-ghost" to="/app/transfer">
            Move to a new device
          </Link>
        </aside>
      </GateShell>
    );
  }

  const canShowPhoneQr = !phoneLike && looksLikeLicenseKey(key);

  return (
    <GateShell>
      <section className="license-gate-panel">
        <BrandMark className="brand-mark license-gate-mark" />
        <p className="eyebrow">Lifetime license</p>
        <h1>{switchingKey ? "Activate another license" : "Activate your license"}</h1>
        <p className="license-gate-lead">
          {switchingKey
            ? "This device already has a license. Activating a different key replaces it here."
            : "Enter the key from your purchase email to use Safety Prep List on this device."}
        </p>

        {notice ? (
          <p className="license-gate-notice" role="status">
            {notice}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="license-gate-form">
          <label className="field">
            <span>License key</span>
            <input
              className="license-key-input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="SPL-XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !key.trim()}>
            {busy ? "Activating…" : "Activate on this device"}
          </button>
        </form>

        {canShowPhoneQr ? (
          <p className="muted license-move-aside">
            Want it on your phone instead?{" "}
            <button className="license-inline-link" type="button" onClick={() => setShowPhoneQr(true)}>
              Show a QR code
            </button>
          </p>
        ) : null}

        <p className="license-gate-assurance">Works offline after activation · One license, one device · No login account</p>
      </section>

      <p className="muted license-gate-foot">
        <Link to="/license-recovery">Forgot your key?</Link>
        {" · "}
        <Link to="/license">License details</Link>
        {" · "}
        <Link to="/#pricing">Buy a license</Link>
      </p>
      {showPhoneQr && canShowPhoneQr ? (
        <ActivateQrDialog licenseKey={key.trim()} onClose={() => setShowPhoneQr(false)} />
      ) : null}
    </GateShell>
  );
}

function MovedOutPanel({
  outcome,
  phoneLike,
  busy,
  error,
  onUseHere,
  onShowQr,
}: {
  outcome: MoveOutcome;
  phoneLike: boolean;
  busy: boolean;
  error: string | null;
  onUseHere: () => void;
  onShowQr: () => void;
}) {
  const link = moveLinkForKey(outcome.key);
  const [copied, setCopied] = useState<"link" | "key" | null>(null);

  async function copy(value: string, what: "link" | "key") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Safety Prep List", url: link });
    } catch {
      /* closed the share sheet */
    }
  }

  const backupLine =
    outcome.backup.kind === "cloud"
      ? `Your checklist is backed up (${describeSummary(outcome.backup.summary)}) until ${formatExpiry(outcome.backup.expiresAt)}.`
      : outcome.backup.kind === "file"
        ? "Your checklist is in the backup file you saved."
        : outcome.backup.kind === "empty"
          ? "There was nothing on this device to back up."
          : "No backup was made.";

  return (
    <section className="license-gate-panel">
      <BrandMark className="brand-mark license-gate-mark" />
      <p className="eyebrow">Move to a new device</p>
      <h1>Now open it on your new device</h1>
      <p className="license-gate-notice" role="status">
        This device is released. {backupLine}
      </p>

      <div className={`license-move-handoff${phoneLike ? " is-phone" : ""}`}>
        {!phoneLike ? <ActivateQrInline licenseKey={outcome.key} onExpand={onShowQr} /> : null}
        <ol className="license-move-steps">
          <li>{phoneLike ? "Open this link on your new device." : "Scan the code with your new device's camera."}</li>
          <li>Tap Activate — your key is already filled in.</li>
          {outcome.backup.kind === "cloud" ? (
            <li>Tap Restore my checklist.</li>
          ) : outcome.backup.kind === "file" ? (
            <li>Restore the backup file (More → Move to a new device).</li>
          ) : null}
        </ol>
      </div>

      <div className="license-gate-actions">
        {phoneLike && typeof navigator.share === "function" ? (
          <button className="btn btn-primary" type="button" onClick={() => void share()}>
            Share the link
          </button>
        ) : null}
        <button className="btn btn-ghost" type="button" onClick={() => void copy(link, "link")}>
          {copied === "link" ? "Link copied" : "Copy link"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => void copy(outcome.key, "key")}>
          {copied === "key" ? "Key copied" : "Copy key"}
        </button>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="license-gate-assurance">
        Changed your mind?{" "}
        <button className="license-inline-link" type="button" disabled={busy} onClick={onUseHere}>
          {busy ? "Activating…" : "Keep using it on this device"}
        </button>
      </p>
    </section>
  );
}
