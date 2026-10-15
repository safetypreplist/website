import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cookieChoice, storeCookieChoice, type CookieChoice } from "../lib/legalConsent";

export function CookieNotice() {
  const [choice, setChoice] = useState<CookieChoice | null>(() => cookieChoice());
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const notice = noticeRef.current;
    if (!notice) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--cookie-notice-h", `${notice.offsetHeight}px`));
    observer.observe(notice);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--cookie-notice-h");
    };
  }, [choice]);

  if (choice) return null;

  function choose(next: CookieChoice) {
    storeCookieChoice(next);
    setChoice(next);
  }

  return (
    <div className="cookie-notice" role="dialog" aria-labelledby="cookie-notice-title" ref={noticeRef}>
      <div className="cookie-notice-inner">
        <div className="cookie-notice-copy">
          <p className="eyebrow" id="cookie-notice-title">Cookie Policy</p>
          <p>
            We use essential cookies to keep you signed in. See the <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
        <div className="cookie-notice-actions">
          <button className="cookie-btn cookie-btn-decline" type="button" onClick={() => choose("essential")}>
            Decline
          </button>
          <button className="cookie-btn cookie-btn-accept" type="button" onClick={() => choose("all")}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
