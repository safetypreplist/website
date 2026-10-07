import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { BrandMark } from "./Brand";
import { HERO_TAGLINE, OFFICIAL_GUIDANCE_DISCLAIMER } from "../lib/copy";
import { copyrightLine } from "../lib/legal";

type HeaderProps = {
  howHref?: string;
  includedHref?: string;
  pricingHref?: string;
};

export function PublicHeader({
  howHref = "/#how",
  includedHref = "/#included",
  pricingHref = "/#pricing",
}: HeaderProps) {
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
          <a href={howHref} onClick={close}>How It Works</a>
          <a href={includedHref} onClick={close}>What’s Included</a>
          <a href={pricingHref} onClick={close}>Choose a Plan</a>
          <NavLink to="/signin" onClick={close}>Log In</NavLink>
        </nav>
        <button className="menu-toggle" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
          ☰
        </button>
      </div>
    </header>
  );
}

export function PublicFooter({
  howHref = "/#how",
  includedHref = "/#included",
  pricingHref = "/#pricing",
}: HeaderProps) {
  return (
    <footer className="public-footer">
      <div className="wrap footer-row">
        <div className="footer-brand">
          <Link className="brand" to="/">
            <BrandMark />
            <div className="brand-text">
              <b>Safety Prep List</b>
              <span>{HERO_TAGLINE}</span>
            </div>
          </Link>
        </div>
        <nav className="footer-links">
          <a href={howHref}>How It Works</a>
          <a href={includedHref}>What’s Included</a>
          <a href={pricingHref}>Choose a Plan</a>
          <NavLink to="/signin">Log In</NavLink>
          <NavLink to="/support">Support</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
          <NavLink to="/terms">Terms</NavLink>
          <NavLink to="/refunds">Refunds</NavLink>
          <NavLink to="/privacy#do-not-sell">Do Not Sell or Share My Personal Information</NavLink>
        </nav>
      </div>
      <div className="wrap footer-bottom">
        <span>{copyrightLine()}</span>
      </div>
      <p className="wrap footer-disclaimer">{OFFICIAL_GUIDANCE_DISCLAIMER}</p>
    </footer>
  );
}
