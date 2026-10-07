import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { recordLegalAcceptance } from "../lib/legalConsent";
import { CHECKLIST_PDF_PATH, subscribeChecklist } from "../lib/subscribe";

export function ChecklistSignupModal({
  alreadyJoined,
  onClose,
  onJoined,
}: {
  alreadyJoined?: boolean;
  onClose: () => void;
  onJoined: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(Boolean(alreadyJoined));
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    if (!alreadyJoined) nameRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [alreadyJoined, onClose]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!agreed) {
        setError("Please agree to receive emails and to the Privacy Policy.");
        setBusy(false);
        return;
      }
      await subscribeChecklist(email, name, honeypot);
      await recordLegalAcceptance("email_signup", email);
      setDone(true);
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the list. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel lead-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-signup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        {done ? (
          <div className="lead-thanks">
            <p className="eyebrow">You’re in</p>
            <h2 id="checklist-signup-title">Thank you for signing up.</h2>
            <p className="muted">Your Emergency Documents Checklist is ready to download.</p>
            <a className="btn btn-primary btn-block" href={CHECKLIST_PDF_PATH} download>
              Download the checklist
            </a>
          </div>
        ) : (
          <>
            <div className="modal-intro">
              <p className="eyebrow">Bonus checklist</p>
              <h2 id="checklist-signup-title">
                Get your <span className="lead-free">FREE</span> Emergency Documents Checklist
              </h2>
              <p>Enter your name and email.</p>
            </div>
            <form className="lead-form" onSubmit={(event) => void onSubmit(event)}>
              <label className="lead-honeypot" htmlFor="lead-company">
                Company
                <input
                  id="lead-company"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Name</span>
                <input
                  ref={nameRef}
                  name="name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <label className="legal-agree" htmlFor="lead-agree">
                <input id="lead-agree" type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                <span>
                  By signing up you agree to receive emails from us and to our{" "}
                  <Link to="/privacy" target="_blank" rel="noreferrer">
                    Privacy Policy
                  </Link>
                  . Unsubscribe anytime.
                </span>
              </label>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy || !agreed}>
                {busy ? "Sending…" : <>Get <span className="lead-free-btn">FREE</span> Checklist</>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
