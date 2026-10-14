import { useState } from "react";
import { Link } from "react-router-dom";
import { cookieChoice, storeCookieChoice, type CookieChoice } from "../lib/legalConsent";

export function CookieNotice() {
  const [choice, setChoice] = useState<CookieChoice | null>(() => cookieChoice());

  if (choice) return null;

  function acknowledge() {
    storeCookieChoice("essential");
    setChoice("essential");
  }

  return (
    <div className="cookie-notice" role="dialog" aria-label="Cookie notice">
      <div className="cookie-notice-inner">
        <div className="cookie-notice-copy">
          <p className="eyebrow">Cookies</p>
          <p>
            We use essential cookies to keep you signed in. See the <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={acknowledge}>
          Got it
        </button>
      </div>
    </div>
  );
}
