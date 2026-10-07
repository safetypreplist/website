import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cookieChoice, storeCookieChoice, type CookieChoice } from "../lib/legalConsent";

const TAWK_SRC = "https://embed.tawk.to/6aa2dcbc8bbe9e343f3ea75a/1k262sgom";

function loadTawk() {
  if (document.querySelector("script[data-spl-tawk]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = TAWK_SRC;
  script.charset = "UTF-8";
  script.setAttribute("crossorigin", "*");
  script.setAttribute("data-spl-tawk", "1");
  document.body.appendChild(script);
}

export function CookieNotice() {
  const [choice, setChoice] = useState<CookieChoice | null>(() => cookieChoice());

  useEffect(() => {
    if (choice === "all") loadTawk();
  }, [choice]);

  if (choice) return null;

  function choose(next: CookieChoice) {
    storeCookieChoice(next);
    setChoice(next);
  }

  return (
    <div className="cookie-notice" role="dialog" aria-label="Cookie notice">
      <p>
        We use essential cookies to keep you signed in. Optional support chat (Tawk.to) uses cookies only if you
        accept. See the <Link to="/privacy">Privacy Policy</Link>.
      </p>
      <div className="cookie-notice-actions">
        <button className="btn btn-ghost" type="button" onClick={() => choose("essential")}>
          Essential only
        </button>
        <button className="btn btn-primary" type="button" onClick={() => choose("all")}>
          Accept optional cookies
        </button>
      </div>
    </div>
  );
}
