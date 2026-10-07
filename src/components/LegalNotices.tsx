import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { GUIDANCE_ACK, LEGAL_VERSIONS } from "../lib/legal";
import {
  hasCurrentLegalAcceptance,
  hasGuidanceAck,
  recordLegalAcceptance,
  storeGuidanceAck,
} from "../lib/legalConsent";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { LegalAgreement } from "./LegalAgreement";

export function LegalNotices() {
  const { session, user } = useApp();
  const location = useLocation();
  const onChecklist = location.pathname.startsWith("/app/lists");
  const [needsTerms, setNeedsTerms] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (hasCurrentLegalAcceptance()) {
      setNeedsTerms(false);
      return;
    }
    if (!isSupabaseConfigured() || !user?.id) {
      setNeedsTerms(true);
      return;
    }
    void supabase
      .from("terms_acceptances")
      .select("terms_version, privacy_version, refund_version")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const latest = data?.[0];
        const current =
          latest?.terms_version === LEGAL_VERSIONS.terms &&
          latest?.privacy_version === LEGAL_VERSIONS.privacy &&
          latest?.refund_version === LEGAL_VERSIONS.refunds;
        setNeedsTerms(!current);
      });
  }, [session, user?.id]);

  useEffect(() => {
    setShowGuidance(Boolean(session && onChecklist && !hasGuidanceAck()));
  }, [session, onChecklist]);

  useEffect(() => {
    document.documentElement.classList.toggle("has-guidance-ack", showGuidance);
    if (!showGuidance) {
      document.documentElement.style.removeProperty("--guidance-h");
      return () => document.documentElement.classList.remove("has-guidance-ack");
    }
    const bar = document.querySelector(".guidance-ack");
    const header = document.querySelector(".app-top");
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
    await recordLegalAcceptance("terms_update", user?.email || undefined);
    setNeedsTerms(false);
    setBusy(false);
  }

  function dismissGuidance() {
    storeGuidanceAck();
    void recordLegalAcceptance("in_app_ack", user?.email || undefined);
    setShowGuidance(false);
  }

  if (needsTerms) {
    return (
      <div className="modal-backdrop" role="presentation">
        <div className="modal-panel sheet-panel" role="dialog" aria-modal="true" aria-labelledby="terms-update-title">
          <h2 id="terms-update-title">We updated our terms</h2>
          <p className="muted">
            Please review the{" "}
            <Link to="/terms" target="_blank" rel="noreferrer">
              Terms of Service
            </Link>
            ,{" "}
            <Link to="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </Link>
            , and{" "}
            <Link to="/terms#refunds" target="_blank" rel="noreferrer">
              Refund Policy
            </Link>{" "}
            before continuing.
          </p>
          <LegalAgreement id="terms-update-agree" checked={agreed} onChange={setAgreed} />
          <button className="btn btn-primary btn-block" type="button" disabled={!agreed || busy} onClick={() => void acceptTerms()}>
            {busy ? "Saving…" : "Agree and continue"}
          </button>
        </div>
      </div>
    );
  }

  if (!showGuidance) return null;

  return (
    <div className="guidance-ack" role="status">
      <p>{GUIDANCE_ACK}</p>
      <button className="btn btn-ghost" type="button" onClick={dismissGuidance}>
        Got it
      </button>
    </div>
  );
}
