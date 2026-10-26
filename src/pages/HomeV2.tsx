import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "../components/Brand";
import { PublicFooter } from "../components/PublicChrome";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { money } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  ANNUAL_CENTS,
  FAMILY_MIN_SEATS,
  MAX_CHECKLIST_QUANTITY,
  SURVIVAL_VAULT_CENTS,
} from "../lib/pricing";
import "../styles/home-v2.css";

const SYSTEMS = [
  {
    title: "Grab-and-Go Bag",
    line: "What stays by the door when you have minutes, not hours.",
    photo: PHOTO_LIBRARY.grab,
  },
  {
    title: "Ready Duffel Bag",
    line: "A 72-hour kit sized for your household, not a generic packing list.",
    photo: PHOTO_LIBRARY.ready,
  },
  {
    title: "Vehicle or Suitcase Prep",
    line: "Evacuation-ready in the car or a packed bag you can grab and leave.",
    photo: PHOTO_LIBRARY.vehicle,
  },
  {
    title: "Home Resilience",
    line: "Supplies and systems that keep you steady when staying put is the plan.",
    photo: PHOTO_LIBRARY.home,
  },
] as const;

const INDIVIDUAL_FEATURES = [
  "Grab-and-Go Bag",
  "Ready Duffel Bag",
  "Vehicle or Suitcase Prep",
  "Home Resilience",
  "Compatible on all devices",
  "Works when offline",
] as const;

const FAMILY_FEATURES = [
  "Everything in Individual, for each person",
  "Connected under one Family Plan",
  "View Only or Can Edit per checklist",
] as const;

function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const items = node.querySelectorAll(".hv2-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return root;
}

export function HomeV2Page() {
  const root = useReveal();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [familyQty, setFamilyQty] = useState(FAMILY_MIN_SEATS);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const price = money(ANNUAL_CENTS);
  const vault = money(SURVIVAL_VAULT_CENTS);
  const familyTotal = money(ANNUAL_CENTS * familyQty);

  function playStoryVideo() {
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(() => setVideoStarted(true)).catch(() => undefined);
  }

  return (
    <div className="hv2" ref={root}>
      <header className="hv2-nav">
        <Link className="hv2-brand" to="/">
          <BrandMark />
          <span>Safety Prep List</span>
        </Link>
        <div className="hv2-nav-end">
          <nav className="hv2-nav-links" aria-label="Page">
            <a href="#included">What’s included</a>
            <a href="#pricing">Pricing</a>
            <Link to="/demo">Try a sample</Link>
            <Link className="hv2-nav-login" to="/signin">
              Log in
            </Link>
          </nav>
          <a className="hv2-nav-cta" href="#pricing">
            Get started
          </a>
        </div>
      </header>

      <section className="hv2-hero">
        <div
          className="hv2-hero-media"
          style={{ backgroundImage: `url(${PHOTO_LIBRARY.hero})` }}
          aria-hidden="true"
        />
        <div className="hv2-hero-shade" aria-hidden="true" />
        <div className="hv2-hero-inner">
          <h1>Be ready before you need to be.</h1>
          <p className="hv2-hero-lead">
            Practical checklists for outages, evacuations, and disruptions on your phone, printed, or offline.
          </p>
          <div className="hv2-hero-actions">
            <a className="hv2-btn hv2-btn-primary" href="#pricing">
              Get your checklist, {price}/year
            </a>
            <Link className="hv2-btn hv2-btn-ghost" to="/demo">
              Try a free sample
            </Link>
          </div>
          <p className="hv2-hero-price">One yearly payment. No monthly subscription.</p>
        </div>
        <div className="hv2-strip" aria-label="At a glance">
          <p>
            <b>{price}</b> per checklist per year
          </p>
          <span aria-hidden="true" />
          <p>No monthly subscription</p>
          <span aria-hidden="true" />
          <p>Access from all devices</p>
          <span aria-hidden="true" />
          <p>Available offline</p>
          <span aria-hidden="true" />
          <p>Family plans available</p>
        </div>
      </section>

      <section className="hv2-section hv2-story">
        <div className="hv2-wrap hv2-story-grid hv2-reveal">
          <div>
            <p className="hv2-eyebrow">Why it exists</p>
            <h2>Most people wait until something goes wrong.</h2>
            <p>
              Then the questions pile up: What goes in the bag? What’s already in the car? What’s missing at home?
              Safety Prep List turns that scramble into a clear list you can work through before the moment arrives.
            </p>
          </div>
          <figure className={`hv2-story-video${videoStarted ? " is-playing" : ""}`}>
            <video
              ref={videoRef}
              controls={videoStarted}
              playsInline
              preload="metadata"
              poster="/images/spl-story-poster.jpg?v=2"
              aria-label="Safety Prep List overview video"
              onPlay={() => setVideoStarted(true)}
            >
              <source src="/videos/spl-story.mp4" type="video/mp4" />
            </video>
            {!videoStarted ? (
              <button className="hv2-story-play" type="button" onClick={playStoryVideo} aria-label="Play video">
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.14v13.72L19 12 8 5.14z" />
                  </svg>
                </span>
              </button>
            ) : null}
          </figure>
        </div>
      </section>

      <section className="hv2-section hv2-included" id="included">
        <div className="hv2-wrap">
          <div className="hv2-section-head hv2-reveal">
            <p className="hv2-eyebrow">What’s included</p>
            <h2>Four checklists. One system.</h2>
            <p>Every Personal Checklist covers the essentials for leaving fast, lasting 72 hours, traveling, and staying home.</p>
          </div>
          <div className="hv2-systems">
            {SYSTEMS.map((system, index) => (
              <article
                key={system.title}
                className="hv2-system hv2-reveal"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <div className="hv2-system-photo" style={{ backgroundImage: `url(${system.photo})` }} />
                <div className="hv2-system-copy">
                  <h3>{system.title}</h3>
                  <p>{system.line}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="hv2-vault-hint hv2-reveal">
            Add Survival Vault and you also get more checklists.{" "}
            <button type="button" className="hv2-text-link" onClick={() => setVaultOpen(true)}>
              See what’s included
            </button>
          </p>
        </div>
      </section>

      <section className="hv2-section hv2-product">
        <div className="hv2-wrap hv2-product-grid hv2-reveal">
          <div className="hv2-product-copy">
            <p className="hv2-eyebrow">Works where you are</p>
            <h2>Works online or offline from any device.</h2>
            <p>
              Add notes. Add a few of your own items. Keep going when the signal drops. Built for real households, not a
              binder you never open.
            </p>
            <ul className="hv2-ticks">
              <li>Check off items on phone, tablet, or desktop</li>
              <li>Works offline after you turn it on</li>
              <li>Print any list for the bag or the fridge</li>
              <li>Family Plan connects personal checklists</li>
            </ul>
          </div>
          <div className="hv2-devices" aria-hidden="false">
            <div className="hv2-device hv2-device-tablet">
              <div className="hv2-device-bezel">
                <img src="/images/hv2-tablet.webp" alt="Safety Prep List dashboard on tablet" />
              </div>
            </div>
            <div className="hv2-device hv2-device-phone">
              <img src="/images/hv2-phone.png" alt="Safety Prep List on phone" />
            </div>
          </div>
        </div>
      </section>

      <section className="hv2-section hv2-how" id="how">
        <div className="hv2-wrap">
          <div className="hv2-section-head hv2-reveal">
            <p className="hv2-eyebrow">How it works</p>
            <h2>Three steps. Then you’re set.</h2>
          </div>
          <ol className="hv2-steps">
            <li className="hv2-reveal">
              <span>01</span>
              <h3>Choose Individual or Family</h3>
              <p>{price} per Personal Checklist for the year.</p>
            </li>
            <li className="hv2-reveal" style={{ transitionDelay: "80ms" }}>
              <span>02</span>
              <h3>Pay once for the year</h3>
              <p className="hv2-step-tight">Secure checkout. Survival Vault add-on {vault}/year.</p>
            </li>
            <li className="hv2-reveal" style={{ transitionDelay: "160ms" }}>
              <span>03</span>
              <h3>Start checking things off</h3>
              <p>Create your account and prep at your pace.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="hv2-section hv2-pricing" id="pricing">
        <div className="hv2-wrap">
          <div className="hv2-section-head hv2-reveal">
            <p className="hv2-eyebrow">Pricing</p>
            <h2>Easy pricing. No hassle.</h2>
            <p>One annual fee. No monthly subscription.</p>
          </div>

          <div className="hv2-price-grid">
            <article className="hv2-price hv2-reveal">
              <p className="hv2-price-kicker">Individual</p>
              <p className="hv2-price-amount">
                {price} <small>/ year</small>
              </p>
              <p className="hv2-price-line">1 Personal Checklist</p>
              <ul className="hv2-checks">
                {INDIVIDUAL_FEATURES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="hv2-btn hv2-btn-primary hv2-btn-block" to="/checkout?plan=individual&access=annual">
                Choose Individual
              </Link>
            </article>

            <article className="hv2-price hv2-price-feature hv2-reveal" style={{ transitionDelay: "90ms" }}>
              <p className="hv2-price-kicker">Family</p>
              <p className="hv2-price-amount">
                {familyTotal} <small>/ year</small>
              </p>
              <p className="hv2-price-line">
                {familyQty} Personal Checklists · {price} each
              </p>
              <div className="hv2-qty-row">
                <span className="hv2-qty-label">Quantity</span>
                <div className="hv2-qty" role="group" aria-label="Family checklist quantity">
                  <button
                    type="button"
                    aria-label="Fewer checklists"
                    disabled={familyQty <= FAMILY_MIN_SEATS}
                    onClick={() => setFamilyQty((n) => Math.max(FAMILY_MIN_SEATS, n - 1))}
                  >
                    −
                  </button>
                  <b>{familyQty}</b>
                  <button
                    type="button"
                    aria-label="More checklists"
                    disabled={familyQty >= MAX_CHECKLIST_QUANTITY}
                    onClick={() => setFamilyQty((n) => Math.min(MAX_CHECKLIST_QUANTITY, n + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <ul className="hv2-checks">
                {FAMILY_FEATURES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link
                className="hv2-btn hv2-btn-primary hv2-btn-block"
                to={`/checkout?plan=family&qty=${familyQty}&access=annual`}
              >
                Choose Family
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="hv2-close">
        <div
          className="hv2-close-media"
          style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
          aria-hidden="true"
        />
        <div className="hv2-close-shade" aria-hidden="true" />
        <div className="hv2-close-inner hv2-reveal">
          <h2>Hope for the best. Prepare for the rest.</h2>
          <p>One checklist per person. One annual fee.</p>
          <a className="hv2-btn hv2-btn-primary" href="#pricing">
            Get Safety Prep List, {price}/year
          </a>
        </div>
      </section>

      <PublicFooter howHref="#how" includedHref="#included" pricingHref="#pricing" />

      {vaultOpen ? <SurvivalVaultModal onClose={() => setVaultOpen(false)} ctaHref="#pricing" /> : null}
    </div>
  );
}
