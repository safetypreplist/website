import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { BrandMark } from "./Brand";

type HeaderProps = {
  pricingHref?: string;
};

export function PublicHeader({ pricingHref = "/#pricing" }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="public-header">
      <div className="public-nav">
        <Link className="brand" to="/">
          <BrandMark />
          <div className="brand-text">
            <b>Safety Prep List</b>
          </div>
        </Link>
        <nav className={`public-links ${open ? "open" : ""}`}>
          <a href="/#how" onClick={close}>How It Works</a>
          <a href={pricingHref} onClick={close}>Shop Systems</a>
          <a href="/#pricing" onClick={close}>Resources</a>
          <a href="/#included" onClick={close}>About</a>
          <NavLink to="/signin" onClick={close}>Log In</NavLink>
        </nav>
        <button className="menu-toggle" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
          ☰
        </button>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="wrap footer-row">
        <div className="footer-brand">
          <Link className="brand" to="/">
            <BrandMark />
            <div className="brand-text">
              <b>Safety Prep List</b>
              <span>Hope for the best. Prepare for the rest.</span>
            </div>
          </Link>
        </div>
        <nav className="footer-links">
          <a href="/#how">How It Works</a>
          <a href="/#pricing">Shop Systems</a>
          <a href="/#pricing">Resources</a>
          <a href="/#included">About</a>
          <NavLink to="/signin">Log In</NavLink>
          <NavLink to="/support">Support</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
          <NavLink to="/terms">Terms</NavLink>
        </nav>
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} Safety Prep List</span>
      </div>
    </footer>
  );
}
