import { Link } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { useApp } from "../context/AppContext";

export function NotFoundPage() {
  const { session } = useApp();
  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page">
          <p className="eyebrow">Page not found</p>
          <h1>We couldn’t find that page.</h1>
          <p>The link may be old or mistyped.</p>
          <p className="legal-nav">
            {session ? <Link to="/app">Go to my checklist</Link> : <Link to="/">Go to the homepage</Link>}
            <Link to="/contact">Contact us</Link>
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
