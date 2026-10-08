import { Link } from "react-router-dom";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  IconBackpack,
  IconCar,
  IconChecklist,
  IconDesktop,
  IconDuffel,
  IconHeat,
  IconHouse,
  IconNotes,
  IconOffgrid,
  IconPhone,
  IconPrint,
  IconSolar,
  IconTablet,
  IconUser,
  IconWater,
  IconFood,
  MarkImg,
} from "../components/Icons";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { HERO_TAGLINE, HERO_TAGLINE_LEAD, HERO_TAGLINE_REST, SCOPE_SUPPORT, VAULT_CHECKLISTS } from "../lib/copy";
import { money } from "../lib/format";
import { recordLegalAcceptance } from "../lib/legalConsent";
import { PHOTO_LIBRARY } from "../lib/photos";
import { HeroSlider } from "../components/HeroSlider";
import { FAMILY_MIN_SEATS, MONTHLY_CENTS } from "../lib/pricing";
import { INCLUDED_CUSTOM_PER_SECTION } from "../lib/customItems";
import { subscribeChecklist } from "../lib/subscribe";

const CODE = "LAUNCH26";
const UNLOCK_KEY = "spl.launch26.unlocked";
const INDIVIDUAL_CENTS = MONTHLY_CENTS;
const FAMILY_CENTS = MONTHLY_CENTS * FAMILY_MIN_SEATS;
const INDIVIDUAL_FIRST_CENTS = INDIVIDUAL_CENTS - Math.round((INDIVIDUAL_CENTS * 50) / 100);
const FAMILY_FIRST_CENTS = FAMILY_CENTS - Math.round((FAMILY_CENTS * 50) / 100);

const individualCheckout = "/checkout?plan=individual&access=monthly";
const familyCheckout = `/checkout?plan=family&qty=${FAMILY_MIN_SEATS}&access=monthly`;

function hasUnlock() {
  try {
    return localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function storeUnlock() {
  localStorage.setItem(UNLOCK_KEY, "1");
}

const primarySystems = [
  {
    minutes: 5,
    mark: "backpack" as const,
    title: "Grab-and-Go Bag",
    line: "A backpack near the exit. The minimum critical layer.",
  },
  {
    minutes: 15,
    mark: "duffel" as const,
    title: "Ready Duffel",
    line: "72-Hour Continuity Kit, adjusted for your household.",
  },
  {
    minutes: 20,
    mark: "vehicle" as const,
    title: "Vehicle OR Suitcase Prep",
    line: "Choose a vehicle kit or an evacuation suitcase.",
  },
  {
    minutes: 60,
    mark: "home" as const,
    title: "Home Resilience",
    line: "The highest-priority safety and continuity needs at home.",
  },
];

const vaultIcons = {
  "Off-Grid Systems": IconOffgrid,
  "Water Purification": IconWater,
  "Home Battery & Solar": IconSolar,
  "Emergency Cooling / Heat Resilience": IconHeat,
  "Long-Term Food": IconFood,
  "How-To Videos": IconChecklist,
} as const;

const individualFeatures = [
  { label: "5-Minute Grab-and-Go Bag", Icon: IconBackpack },
  { label: "15-Minute Ready Duffel", Icon: IconDuffel },
  { label: "20-Minute Vehicle OR Suitcase Prep", Icon: IconCar },
  { label: "60-Minute Home Resilience", Icon: IconHouse },
  { label: `Up to ${INCLUDED_CUSTOM_PER_SECTION} custom items per section`, Icon: IconNotes },
];

export function Launch26Page() {
  const [vaultOpen, setVaultOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(true);
  const [unlocked, setUnlocked] = useState(hasUnlock);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = `50% Off — ${HERO_TAGLINE}`;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!offerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOfferOpen(false);
    };
    window.addEventListener("keydown", onKey);
    if (!unlocked) emailRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [offerOpen, unlocked]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please agree to receive emails and to the Privacy Policy.");
      return;
    }
    setBusy(true);
    try {
      await subscribeChecklist(email, "", honeypot);
      await recordLegalAcceptance("email_signup", email);
      storeUnlock();
      setUnlocked(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send that. Please try again.";
      if (import.meta.env.DEV && /not connected|BREVO/i.test(message)) {
        await recordLegalAcceptance("email_signup", email);
        storeUnlock();
        setUnlocked(true);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  function goToPlans() {
    setOfferOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="marketing-page launch-page">
      <PublicHeader howHref="#how" includedHref="#included" pricingHref="#plans" />

      {offerOpen ? (
        <div className="launch-offer-layer" role="presentation" onClick={() => setOfferOpen(false)}>
          <div
            className="launch-offer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="launch-offer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="launch-offer-close" type="button" aria-label="Close" onClick={() => setOfferOpen(false)}>
              ×
            </button>
            {unlocked ? (
              <>
                <p className="eyebrow">First month only</p>
                <h2 id="launch-offer-title">Your 50% off code</h2>
                <p>Use this code at checkout to save 50% on your first month. Regular monthly pricing begins in month two.</p>
                <p className="launch-offer-hint">Use this code</p>
                <div className="launch-offer-code">
                  <b>{CODE}</b>
                  <button className="btn btn-primary" type="button" onClick={() => void copyCode()}>
                    {copied ? "Copied" : "Copy code"}
                  </button>
                </div>
                {copied ? <p className="launch-offer-copied">{CODE} is copied. Paste it at checkout.</p> : null}
                <button className="btn btn-ghost launch-offer-next" type="button" onClick={goToPlans}>
                  Choose a plan
                </button>
              </>
            ) : (
              <>
                <p className="eyebrow">First month only</p>
                <h2 id="launch-offer-title">Get 50% off your first month</h2>
                <p>Enter your email and we’ll show the checkout code.</p>
                <form className="launch-offer-form" onSubmit={(event) => void submitEmail(event)}>
                  <label className="lead-honeypot" htmlFor="launch-company">
                    Company
                    <input
                      id="launch-company"
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(event) => setHoneypot(event.target.value)}
                    />
                  </label>
                  <label className="account-field">
                    <span>Email</span>
                    <input
                      ref={emailRef}
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  {error ? <p className="form-error">{error}</p> : null}
                  <label className="legal-agree" htmlFor="launch-agree">
                    <input
                      id="launch-agree"
                      type="checkbox"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                    />
                    <span>
                      By continuing you agree to receive emails from us and to our{" "}
                      <Link to="/privacy" target="_blank" rel="noreferrer">
                        Privacy Policy
                      </Link>
                      . Unsubscribe anytime.
                    </span>
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={busy || !agreed}>
                    {busy ? "Sending…" : "Get my code"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}

      <section className="hero-studio">
        <div className="hero-copy-col">
          <div className="hero-copy">
            <h1 className="hero-product">
              <span>Get Your Safety</span> <span>Prep List</span>
            </h1>
            <p className="hero-tagline">
              <span>{HERO_TAGLINE_LEAD}</span>{" "}
              <span>{HERO_TAGLINE_REST}</span>
            </p>
            <p className="hero-sub">
              Practical preparedness for natural disasters, <span className="nowrap">local emergencies</span>, outages, evacuations, and temporary disruptions.
            </p>
            <button className="btn btn-primary" type="button" onClick={() => setOfferOpen(true)}>
              Claim 50% Off Your First Month
            </button>
          </div>
        </div>
        <HeroSlider />
        <div className="hero-slash" aria-hidden="true">
          <span className="slash slash-soft" />
          <span className="slash slash-deep" />
          <span className="slash slash-solid" />
        </div>
      </section>

      <section className="section forest story-section" id="about">
        <div className="wrap story-split">
          <div className="story-photo story-phone">
            <div className="story-device-stage">
              <img className="story-phone-render" src="/images/safety-prep-phone.png?v=2" alt="Safety Prep List checklist displayed on a smartphone" />
              <div className="story-dashboard-frame">
                <img src="/images/desktop-dashboard.webp" alt="Safety Prep List checklist dashboard on desktop" />
              </div>
            </div>
          </div>
          <div className="story-copy">
            <h2>A practical checklist for emergencies and disruptions</h2>
            <p>
              Know what to pack, what to store, and what to do next. Check items off, add personal notes, and keep your
              household organized in one place.
            </p>
            <ul className="story-platforms" aria-label="Works as a printable list, and on desktop, tablet, and phone">
              <li>
                <IconPrint />
                <span>Printable</span>
              </li>
              <li>
                <IconDesktop />
                <span>Desktop</span>
              </li>
              <li>
                <IconTablet />
                <span>Tablet</span>
              </li>
              <li>
                <IconPhone />
                <span>Phone</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section sand systems-band" id="included">
        <div className="wrap">
          <div className="section-head">
            <h2>What’s included:</h2>
          </div>
          <div className="system-tabs">
            {primarySystems.map((system) => (
              <article className="system-tab" key={system.minutes}>
                <MarkImg name={system.mark} />
                <p className="time-label">
                  <b>{system.minutes}</b>
                  MINUTES
                </p>
                <h3>{system.title}</h3>
                <p>{system.line}</p>
              </article>
            ))}
          </div>
          <div className="time-session-note">
            <p>
              These times are a priority session. They do not mean every preparedness item can be finished in that many
              minutes. Have more time? {SCOPE_SUPPORT}
            </p>
          </div>
          <div className="vault-included">
            <p className="vault-included-lead">
              <b>Survival Vault.</b> Get it for an additional one-time fee of $10, and you also unlock these checklists.
            </p>
            <ul className="vault-included-grid">
              {VAULT_CHECKLISTS.map((item) => {
                const Icon = vaultIcons[item.title];
                return (
                  <li key={item.title}>
                    <Icon />
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.line}</p>
                      <p>{item.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="how-forest" id="how">
        <div className="how-forest-bg" style={{ backgroundImage: `url(${PHOTO_LIBRARY.forestfloor})` }} aria-hidden="true" />
        <div className="wrap">
          <div className="section-head light">
            <h2>How it works:</h2>
          </div>
          <ol className="how-cols">
            <li>
              <span className="how-icon">
                <MarkImg name="checklist" />
              </span>
              <span className="step-num">Step 1</span>
              <h3>Choose your plan</h3>
              <p>Choose Individual Plan or Family Plan with connected Personal Checklists.</p>
            </li>
            <li>
              <span className="how-icon">
                <MarkImg name="bag" />
              </span>
              <span className="step-num">Step 2</span>
              <h3>Complete your purchase</h3>
              <p>Check out securely. Choose monthly or annual billing, and optionally add Survival Vault.</p>
            </li>
            <li>
              <span className="how-icon">
                <IconUser />
              </span>
              <span className="step-num">Step 3</span>
              <h3>Start prepping</h3>
              <p>Create your account and start checking things off.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section forest pricing-band" id="plans">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Limited time deal</p>
            <h2>50% off your first month</h2>
            <p>First month only. Regular monthly pricing begins in the second month.</p>
          </div>
          <div className="price-grid">
            <article className="price-card">
              <span className="price-corners" aria-hidden="true" />
              <h3>Individual Plan</h3>
              <p className="launch-was">
                <span>Regular price</span>
                <s>{money(INDIVIDUAL_CENTS)}/month</s>
              </p>
              <div className="amount">
                {money(INDIVIDUAL_FIRST_CENTS)} <small>first month</small>
              </div>
              <p className="launch-off">50% off your first month</p>
              <p className="plan-line">1 Personal Checklist</p>
              <ul>
                {individualFeatures.map((item) => (
                  <li key={item.label}>
                    <item.Icon />
                    {item.label}
                  </li>
                ))}
              </ul>
              <Link className="btn btn-primary btn-block" to={individualCheckout}>
                Choose Individual
              </Link>
            </article>
            <article className="price-card featured">
              <span className="price-corners" aria-hidden="true" />
              <h3>Family Plan</h3>
              <p className="launch-was">
                <span>Regular price</span>
                <s>{money(FAMILY_CENTS)}/month</s>
              </p>
              <div className="amount">
                {money(FAMILY_FIRST_CENTS)} <small>first month</small>
              </div>
              <p className="launch-off">50% off your first month</p>
              <p className="plan-line">{FAMILY_MIN_SEATS} Personal Checklists</p>
              <p className="plan-plus">Everything in Individual, plus:</p>
              <ul>
                <li><IconUser /> Each member gets their own Personal Checklist</li>
                <li><IconChecklist /> Connected under one Family Plan</li>
                <li><IconNotes /> View Only or Can Edit permissions per owner</li>
              </ul>
              <Link className="btn btn-primary btn-block" to={familyCheckout}>
                Choose Family
              </Link>
            </article>
          </div>
          <p className="launch-billing-note">
            50% off your first month only. Regular monthly pricing applies beginning in month two.
          </p>
          <aside className="vault-cta-strip" id="survival-vault">
            <div>
              <p className="eyebrow">Optional add-on</p>
              <h3>
                Survival Vault for an additional $10 <small>/ one time</small>
              </h3>
              <p>
                Expand your checklist to include Off-Grid Systems, Water Purification, Home Battery &amp; Solar, Emergency Cooling / Heat Resilience, and Long-Term Food. How-To Videos is a curated YouTube playlist from independent creators and organizations.
              </p>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => setVaultOpen(true)}>
              See details
            </button>
          </aside>
        </div>
      </section>

      {vaultOpen ? (
        <SurvivalVaultModal
          ctaHref="/checkout?plan=individual&access=monthly&vault=1"
          onClose={() => setVaultOpen(false)}
        />
      ) : null}

      <PublicFooter howHref="#how" includedHref="#included" pricingHref="#plans" />
    </div>
  );
}
