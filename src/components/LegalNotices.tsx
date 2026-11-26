import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isLicensed } from "../lib/licenseClient";
import { GUIDANCE_ACK, LEGAL_VERSIONS } from "../lib/legal";
import {
  hasCurrentLegalAcceptance,
  hasGuidanceAck,
  latestLocalAcceptance,
  recordLegalAcceptance,
  storeGuidanceAck,
} from "../lib/legalConsent";
import { LegalAgreement } from "./LegalAgreement";
import { isOnboardingPending, ONBOARDING_CHANGE_EVENT } from "./OnboardingTour";

export function LegalNotices() {
  const licensed = isLicensed();
  const location = useLocation();
  const onChecklist = location.pathname.startsWith("/app/lists");
  const [needsTerms, setNeedsTerms] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Hold any re-prompt until first-run onboarding is finished so it never stacks on the tour.
    const check = () => setNeedsTerms(licensed && !hasCurrentLegalAcceptance() && !isOnboardingPending());
    check();
    window.addEventListener(ONBOARDING_CHANGE_EVENT, check);
    return () => window.removeEventListener(ONBOARDING_CHANGE_EVENT, check);
  }, [licensed]);

  useEffect(() => {
    setShowGuidance(Boolean(licensed && onChecklist && !hasGuidanceAck()));
  }, [licensed, onChecklist]);

  useEffect(() => {
    document.documentElement.classList.toggle("has-guidance-ack", showGuidance);
    if (!showGuidance) {
      document.documentElement.style.removeProperty("--guidance-h");
      return () => document.documentElement.classList.remove("has-guidance-ack");
    }
    const bar = document.querySelector(".guidance-ack");
    const header = document.querySelector<HTMLElement>(".app-top");
    const measure = () => {
      const headerHeight = header ? Math.ceil(header.offsetHeight) : 74;
      document.documentElement.style.setProperty("--app-header-h", `${headerHeight}px`);
      if (!bar) return;
      document.documentElement.style.setProperty("--guidance-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (bar) observer.observe(bar);
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("has-guidance-ack");
      document.documentElement.style.removeProperty("--guidance-h");
    };
  }, [showGuidance]);

  async function acceptTerms() {
    if (!agreed) return;
    setBusy(true);
    await recordLegalAcceptance("terms_update");
    setNeedsTerms(false);
    setBusy(false);
  }

  function dismissGuidance() {
    storeGuidanceAck();
    void recordLegalAcceptance("in_app_ack");
    setShowGuidance(false);
  }

  if (needsTerms) {
    return (
      <div className="modal-backdrop" role="presentation">
        <div className="modal-panel sheet-panel" role="dialog" aria-modal="true" aria-labelledby="terms-update-title">
          <h2 id="terms-update-title">{latestLocalAcceptance() ? "We updated our terms" : "Please review our terms"}</h2>
          <p className="muted">
            Please review the{" "}
            <Link to="/terms" target="_blank" rel="noreferrer">
              Terms
            </Link>
            ,{" "}
            <Link to="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </Link>
            , and{" "}
            <Link to="/refunds" target="_blank" rel="noreferrer">
              Refund Policy
            </Link>{" "}
            (v{LEGAL_VERSIONS.terms}).
          </p>
          <LegalAgreement checked={agreed} onChange={setAgreed} />
          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" type="button" disabled={!agreed || busy} onClick={() => void acceptTerms()}>
              {busy ? "Saving…" : "I agree"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showGuidance) return null;

  return (
    <div className="guidance-ack" role="status">
      <p>
        {GUIDANCE_ACK}{" "}
        <button className="btn btn-ghost" type="button" onClick={dismissGuidance}>
          Got it
        </button>
      </p>
    </div>
  );
}
