import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "../components/Brand";
import { PublicFooter } from "../components/PublicChrome";
import { money } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  BASIC_LICENSE_CENTS,
  PRO_LICENSE_CENTS,
} from "../lib/pricing";
import "../styles/home-v2.css";

const HERO_BENEFITS = [
  "Ready-to-Use Emergency Checklists",
  "Works Offline After Activation",
  "Add Notes & Details",
  "One-Time Purchase. Lifetime Access",
] as const;

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

const PRO_SYSTEMS = [
  {
    title: "Off-Grid Systems",
    line: "Stay capable when the grid is down — tools, sanitation, and manual household systems.",
    photo: PHOTO_LIBRARY.offgrid,
  },
  {
    title: "Water Purification",
    line: "Store, filter, and treat drinking water beyond the bottles in the pantry.",
    photo: PHOTO_LIBRARY.water,
  },
  {
    title: "Home Battery & Solar",
    line: "Plan battery capacity, solar input, and the devices that matter overnight.",
    photo: PHOTO_LIBRARY.power,
  },
  {
    title: "Emergency Cooling",
    line: "Blackout cooling, shaded rooms, hydration, and safe warmth when HVAC fails.",
    photo: PHOTO_LIBRARY.cooling,
  },
  {
    title: "Long-Term Food",
    line: "A pantry built for weeks — staples, rotation, and prep after the first few days.",
    photo: PHOTO_LIBRARY.food,
  },
] as const;

const BASIC_FEATURES = [
  "Grab-and-Go Bag",
  "Ready Duffel Bag",
  "Vehicle or Suitcase Prep",
  "Home Resilience",
  "Works offline on one device",
] as const;

const PRO_FEATURES = [
  "Everything in Basic",
  "Off-grid systems",
  "Water purification",
  "Home battery and solar",
  "Emergency cooling",
  "Long-term food",
  "Works offline on one device",
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
          <Link className="hv2-nav-cta" to="/checkout?product=basic">
            Get started
          </Link>
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
            Practical checklists for outages, evacuations, and disasters. Works offline once activated, no account needed.
          </p>
          <div className="hv2-hero-actions">
            <Link className="hv2-btn hv2-btn-primary" to="/checkout?product=basic">
              Get started for {basicPrice}
            </Link>
            <Link className="hv2-btn hv2-btn-ghost" to="/demo">
              Try a free sample
            </Link>
          </div>
          <p className="hv2-hero-price">One-time purchase, lifetime access on one device.</p>
        </div>
        <div className="hv2-strip" aria-label="At a glance">
          {HERO_BENEFITS.map((benefit, index) => (
            <span key={benefit} className="hv2-strip-item">
              {index > 0 ? <span className="hv2-strip-dot" aria-hidden="true" /> : null}
              <p>{benefit}</p>
            </span>
          ))}
        </div>
      </section>

      <section className="hv2-section hv2-story">
        <div className="hv2-wrap hv2-story-grid hv2-reveal">
          <div>
            <p className="hv2-eyebrow">Why it exists</p>
            <h2>Most people wait until something goes wrong.</h2>
            <p>
              Most of us don’t think about emergencies until they’re right in front of us. Then the questions come fast.
              What do I grab? What’s already in the car? What’s missing at home? Safety Prep List helps you answer those
              questions before the moment arrives.
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
            <h2>Checklists That Make Preparing Easier.</h2>
            <p>
              Every core checklist helps you prepare to leave quickly, stay 72 hours, travel, and stay ready at home.
            </p>
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

          <div className="hv2-pro-promo hv2-reveal">
            <div className="hv2-section-head hv2-pro-promo-head">
              <p className="hv2-eyebrow">Pro add-ons</p>
              <h2>Want to Go Further?</h2>
              <p>
                Upgrade to Pro and get everything included in Basic, plus five additional preparedness checklists to help
                you prepare for more situations.
              </p>
            </div>
            <div className="hv2-systems">
              {PRO_SYSTEMS.map((system, index) => (
                <article
                  key={system.title}
                  className="hv2-system hv2-reveal"
                  style={{ transitionDelay: `${index * 70}ms` }}
                >
                  <div className="hv2-system-photo" style={{ backgroundImage: `url(${system.photo})` }} />
                  <div className="hv2-system-copy">
                    <p className="hv2-system-badge">Pro checklist</p>
                    <h3>{system.title}</h3>
                    <p>{system.line}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="hv2-vault-hint">
              These five are in addition to the Basic checklists above.{" "}
              <a className="hv2-text-link" href="#pricing">
                Compare Basic and Pro
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="hv2-section hv2-product">
        <div className="hv2-wrap hv2-product-grid hv2-reveal">
          <div className="hv2-product-copy">
            <h2>
              Works Anywhere.
              <span className="hv2-heading-accent">No Wi-Fi Needed.</span>
            </h2>
            <p>
              Your checklists live on your device, so they’re there when the power is out, the signal is gone, or you’re
              somewhere with no connection at all. Add notes, keep track of what you have, and stay organized without
              ever needing the internet.
            </p>
            <ul className="hv2-ticks">
              <li>Check things off right on your phone or computer.</li>
              <li>Your checklist stays on your device. No account, no sign-in, no internet needed.</li>
              <li>Print or save as PDF if you want a paper copy.</li>
            </ul>
            <p className="hv2-product-note">
              Wi-Fi is needed once, to activate. After that, go fully offline.
            </p>
            <div className="hv2-product-actions">
              <Link className="hv2-btn hv2-btn-ghost" to="/demo">
                See Demo
              </Link>
            </div>
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
                Basic covers the core checklists. Pro adds the extra off-grid, water, power, and food checklists.
              </p>
            </li>
            <li className="hv2-reveal" style={{ transitionDelay: "80ms" }}>
              <span>02</span>
              <h3>Pay once</h3>
              <p>No recurring payments. Complete secure checkout. No subscriptions, ever.</p>
            </li>
            <li className="hv2-reveal" style={{ transitionDelay: "160ms" }}>
              <span>03</span>
              <h3>Activate and get prepared</h3>
              <p>Wi-Fi is needed for that one step. After that, your checklists work offline.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="hv2-section hv2-pricing" id="pricing">
        <div className="hv2-wrap">
          <div className="hv2-section-head hv2-reveal">
            <p className="hv2-eyebrow">Pricing</p>
            <h2 className="hv2-price-heading">
              One-time purchase.
              <span>Lifetime access.</span>
            </h2>
            <p>No subscription. Choose the level of preparedness that’s right for you.</p>
          </div>

          <div className="hv2-price-grid">
            <article className="hv2-price hv2-reveal">
              <p className="hv2-price-kicker">Basic</p>
              <p className="hv2-price-amount">
                {basicPrice} <small>one time</small>
              </p>
              <ul className="hv2-checks">
                {BASIC_FEATURES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="hv2-btn hv2-btn-primary hv2-btn-block" to="/checkout?product=basic">
                Choose Basic
              </Link>
            </article>

            <article className="hv2-price hv2-price-feature hv2-reveal" style={{ transitionDelay: "90ms" }}>
              <p className="hv2-price-kicker">Pro</p>
              <p className="hv2-price-amount">
                {proPrice} <small>one time</small>
              </p>
              <ul className="hv2-checks">
                {PRO_FEATURES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="hv2-btn hv2-btn-primary hv2-btn-block" to="/checkout?product=pro">
                Choose Pro
              </Link>
            </article>
          </div>
          <p className="muted" style={{ marginTop: 22, textAlign: "center", maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            Your license works on one device at a time. To move it,{" "}
            <Link to="/deactivate">deactivate &amp; transfer</Link>, then activate on the new device.
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
          <p>One-time purchase, lifetime access.</p>
          <Link className="hv2-btn hv2-btn-primary" to="/checkout?product=basic">
            Get started for {basicPrice}
          </Link>
        </div>
      </section>

      <PublicFooter howHref="#how" includedHref="#included" pricingHref="#pricing" />

    </div>
  );
}
