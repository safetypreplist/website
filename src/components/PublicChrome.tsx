import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { BrandMark } from "./Brand";
import { copyrightLine } from "../lib/legal";

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
          <a href="/#included" onClick={close}>What’s Included</a>
          <a href={pricingHref} onClick={close}>Choose a Plan</a>
          <a href="/#free-checklist" onClick={close}>Free Checklist</a>
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
          <a href="/#included">What’s Included</a>
          <a href="/#pricing">Choose a Plan</a>
          <a href="/#free-checklist">Free Checklist</a>
          <NavLink to="/signin">Log In</NavLink>
          <NavLink to="/support">Support</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
          <NavLink to="/terms">Terms</NavLink>
        </nav>
      </div>
      <div className="wrap footer-bottom">
        <span>{copyrightLine()}</span>
      </div>
    </footer>
  );
}
