import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "../components/Brand";
import { PublicFooter } from "../components/PublicChrome";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { money } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  BASIC_LICENSE_CENTS,
  PRO_LICENSE_CENTS,
  UPGRADE_TO_PRO_CENTS,
} from "../lib/pricing";
import {
  BASIC_LICENSE_DESCRIPTION,
  ONE_LICENSE_ONE_DEVICE_LINE,
  PRO_LICENSE_DESCRIPTION,
} from "../lib/copy";
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

const BASIC_FEATURES = [
  "Grab-and-Go Bag",
  "Ready Duffel Bag",
  "Vehicle or Suitcase Prep",
  "Home Resilience",
  "Works offline on one device",
  "Lifetime access — one-time purchase",
] as const;

const PRO_FEATURES = [
  "Everything in Basic",
  "Off-grid, water, power, and long-term food",
  "Works offline on one device",
  "Lifetime access — one-time purchase",
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
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const basicPrice = money(BASIC_LICENSE_CENTS);
  const proPrice = money(PRO_LICENSE_CENTS);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void video.play().catch(() => undefined);
  }, []);

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
            <Link className="hv2-nav-login" to="/activate">
              Activate
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
        >
          <video
            ref={heroVideoRef}
            className="hv2-hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={PHOTO_LIBRARY.hero}
            tabIndex={-1}
          >
            <source src="/videos/safety.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hv2-hero-shade" aria-hidden="true" />
        <div className="hv2-hero-inner">
          <h1>Be ready before you need to be.</h1>
          <p className="hv2-hero-lead">
            Practical checklists for outages, evacuations, and disruptions on your phone, printed, or offline.
          </p>
          <div className="hv2-hero-actions">
            <a className="hv2-btn hv2-btn-primary" href="#pricing">
              Get started — from {basicPrice}
            </a>
            <Link className="hv2-btn hv2-btn-ghost" to="/demo">
              Try a free sample
            </Link>
          </div>
          <p className="hv2-hero-price">One-time purchase. Lifetime access on one device.</p>
        </div>
        <div className="hv2-strip" aria-label="At a glance">
          <p>
            <b>{basicPrice}</b> Basic · <b>{proPrice}</b> Pro
          </p>
          <span aria-hidden="true" />
          <p>One-time purchase</p>
          <span aria-hidden="true" />
          <p>One license, one device</p>
          <span aria-hidden="true" />
          <p>Works offline</p>
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
            Pro includes Survival Vault and these extra checklists.{" "}
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
              <li>Works offline on the device you activate</li>
              <li>Print any list for the bag or the fridge</li>
              <li>One license covers one device</li>
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
              <h3>Choose Basic or Pro</h3>
              <p>
                {basicPrice} or {proPrice} — one-time, lifetime access on one device.
              </p>
            </li>
            <li className="hv2-reveal" style={{ transitionDelay: "80ms" }}>
              <span>02</span>
              <h3>Pay once</h3>
              <p className="hv2-step-tight">Secure checkout. No subscription.</p>
            </li>
            <li className="hv2-reveal" style={{ transitionDelay: "160ms" }}>
              <span>03</span>
              <h3>Activate and start checking things off</h3>
              <p>Enter your license key on this device and prep at your pace.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="hv2-section hv2-pricing" id="pricing">
        <div className="hv2-wrap">
          <div className="hv2-section-head hv2-reveal">
            <p className="hv2-eyebrow">Pricing</p>
            <h2>One-time purchase. Lifetime access.</h2>
            <p>{ONE_LICENSE_ONE_DEVICE_LINE}</p>
          </div>

          <div className="hv2-price-grid">
            <article className="hv2-price hv2-reveal">
              <p className="hv2-price-kicker">Basic</p>
              <p className="hv2-price-amount">
                {basicPrice} <small>one time</small>
              </p>
              <p className="hv2-price-line">Core checklists · one device</p>
              <ul className="hv2-checks">
                {BASIC_FEATURES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
                {BASIC_LICENSE_DESCRIPTION}
              </p>
              <Link className="hv2-btn hv2-btn-primary hv2-btn-block" to="/checkout?product=basic">
                Choose Basic
              </Link>
            </article>

            <article className="hv2-price hv2-price-feature hv2-reveal" style={{ transitionDelay: "90ms" }}>
              <p className="hv2-price-kicker">Pro</p>
              <p className="hv2-price-amount">
                {proPrice} <small>one time</small>
              </p>
              <p className="hv2-price-line">Everything in Basic + Survival Vault</p>
              <ul className="hv2-checks">
                {PRO_FEATURES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
                {PRO_LICENSE_DESCRIPTION}
              </p>
              <Link className="hv2-btn hv2-btn-primary hv2-btn-block" to="/checkout?product=pro">
                Choose Pro
              </Link>
            </article>
          </div>
          <p className="muted" style={{ marginTop: 22, textAlign: "center" }}>
            Already have Basic? Upgrade to Pro for {money(UPGRADE_TO_PRO_CENTS)} on the{" "}
            <Link to="/license">license page</Link> — same key, same device.
          </p>
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
          <p>One license. One device. Lifetime access.</p>
          <a className="hv2-btn hv2-btn-primary" href="#pricing">
            Get started — from {basicPrice}
          </a>
        </div>
      </section>

      <PublicFooter howHref="#how" includedHref="#included" pricingHref="#pricing" />

      {vaultOpen ? <SurvivalVaultModal onClose={() => setVaultOpen(false)} ctaHref="#pricing" /> : null}
    </div>
  );
}
