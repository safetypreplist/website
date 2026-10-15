import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "./Brand";
import { copyrightLine } from "../lib/legal";
import { PHOTO_LIBRARY } from "../lib/photos";

export function ComingSoonPage({ message, preview = false }: { message: string; preview?: boolean }) {
  useEffect(() => {
    // Keep the placeholder out of search results while it is up.
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, []);

  return (
    <main className="coming-soon">
      <div className="coming-soon-bg" style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }} aria-hidden="true" />
      <div className="coming-soon-card">
        <BrandMark className="coming-soon-logo" />
        <p className="eyebrow">Coming Soon</p>
        <h1>Safety Prep List</h1>
        <p className="coming-soon-message">{message}</p>
        {preview ? (
          <p className="coming-soon-preview">
            Preview only. <Link to="/admin">Back to admin</Link>
          </p>
        ) : null}
      </div>
      <footer className="coming-soon-footer">
        <Link className="coming-soon-admin" to="/signin">
          Administrator login
        </Link>
        <p>
          {copyrightLine()} · Powered by{" "}
          <a href="https://www.iflipbrands.com" target="_blank" rel="noopener noreferrer">
            iFlipBrands
          </a>
        </p>
      </footer>
    </main>
  );
}

/** Shown only to the owner on public pages, so it is obvious visitors currently see the Coming Soon page. */
export function ComingSoonOwnerPill() {
  return (
    <Link className="coming-soon-pill" to="/admin" title="Open admin to turn Coming Soon Mode off">
      <span aria-hidden="true" />
      Coming Soon Mode is on. Visitors can’t see this site.
    </Link>
  );
}
