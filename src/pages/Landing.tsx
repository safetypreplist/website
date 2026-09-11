import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  IconBackpack,
  IconCar,
  IconChecklist,
  IconDesktop,
  IconDuffel,
  IconFood,
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
  MarkImg,
} from "../components/Icons";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { ChecklistSignupModal } from "../components/ChecklistSignupModal";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { money } from "../lib/format";
import { PHOTO_LIBRARY, HERO_SLIDES } from "../lib/photos";
import {
  ANNUAL_CENTS,
  FAMILY_MIN_SEATS,
  MONTHLY_CENTS,
  checkoutBreakdown,
  type AccessInterval,
} from "../lib/pricing";
import { useApp } from "../context/AppContext";

const primarySystems = [
  {
    minutes: 5,
    mark: "backpack" as const,
    title: "Grab & Go Bag",
    line: "Immediate essentials for leaving quickly.",
  },
  {
    minutes: 15,
    mark: "duffel" as const,
    title: "Ready Duffel",
    line: "Build a more complete 72-hour preparedness bag.",
  },
  {
    minutes: 20,
    mark: "vehicle" as const,
    title: "Vehicle & Suitcase",
    line: "Prepare your vehicle and travel essentials.",
  },
  {
    minutes: 60,
    mark: "home" as const,
    title: "Home Resilience",
    line: "Strengthen your water, food, power, and home readiness.",
  },
];

const vaultExtras = [
  {
    title: "Off-Grid Systems",
    line: "Tools and household systems when utilities are down.",
    Icon: IconOffgrid,
  },
  {
    title: "Water Purification",
    line: "Store, filter, and treat drinking water.",
    Icon: IconWater,
  },
  {
    title: "Backup Power",
    line: "Battery, solar, and charging for essential loads.",
    Icon: IconSolar,
  },
  {
    title: "Cooling & Heat",
    line: "Stay safer when HVAC is out.",
    Icon: IconHeat,
  },
  {
    title: "Long-Term Food",
    line: "Staples and pantry planning beyond a few days.",
    Icon: IconFood,
  },
];

const coreFeatures = [
  { label: "5-mins Grab & Go Bag", Icon: IconBackpack },
  { label: "15-mins Ready Duffel", Icon: IconDuffel },
  { label: "20-mins Vehicle & Suitcase", Icon: IconCar },
  { label: "60-mins Home Resilience", Icon: IconHouse },
  { label: "Up to 5 custom items per section", Icon: IconNotes },
];

export function LandingPage() {
  const { products } = useApp();
  const monthly = products.find((p) => p.slug === "access_monthly");
  const annual = products.find((p) => p.slug === "access_annual");
  const monthlyCents = monthly?.amount_cents ?? MONTHLY_CENTS;
  const annualCents = annual?.amount_cents ?? ANNUAL_CENTS;
  const [billing, setBilling] = useState<AccessInterval>("monthly");
  const [familyQty, setFamilyQty] = useState(FAMILY_MIN_SEATS);
  const [heroSlide, setHeroSlide] = useState(0);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const family = checkoutBreakdown(familyQty, billing, false);

  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace("#", "");
      if (id === "full-system") {
        setVaultOpen(true);
        return;
      }
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const timer = window.setTimeout(scrollToHash, 50);
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => {
      setHeroSlide((index) => (index + 1) % HERO_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="marketing-page">
      <PublicHeader pricingHref="#pricing" />

      <section className="hero-studio">
        <div className="hero-copy-col">
          <div className="hero-copy">
            <h1 className="hero-product">Safety Prep List</h1>
            <p className="hero-tagline">Hope for the best. Prepare for the rest.</p>
            <p className="hero-sub">4 Digital & Printable Preparedness Checklists</p>
            <p className="lead">
              Prepare your bag, vehicle, home, and emergency essentials with four simple guided checklists. Use them on
              your phone, tablet, or computer, or print them anytime for offline access.
            </p>
            <a className="btn btn-primary" href="#pricing">Get Safety Prep List</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-slides" style={{ transform: `translateX(-${heroSlide * 100}%)` }}>
            {HERO_SLIDES.map((slide) => (
              <img className="hero-slide" src={slide.src} alt={slide.alt} key={slide.src} />
            ))}
          </div>
        </div>
        <div className="hero-slash" aria-hidden="true">
          <span className="slash slash-soft" />
          <span className="slash slash-deep" />
          <span className="slash slash-solid" />
        </div>
      </section>

      <section className="section cream" id="included">
        <div className="wrap story-split">
          <div className="story-photo">
            <img src={PHOTO_LIBRARY.devices} alt="Safety Prep List on a phone and desktop, showing the checklist and dashboard" />
          </div>
          <div className="story-copy">
            <h2>Be ready before you need to be.</h2>
            <p className="story-kicker">A clear checklist makes all the difference.</p>
            <p>Know what to pack, what to store, and what to do next.</p>
            <p>
              Check off items as you prepare, add personal notes, and keep your household’s readiness organized in one place.
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

      <section className="section sand systems-band" id="systems">
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
          <div className="vault-included">
            <p className="vault-included-lead">
              If you upgrade to the <b>Survival Vault</b>, you can also get:
            </p>
            <ul className="vault-included-grid">
              {vaultExtras.map((item) => (
                <li key={item.title}>
                  <item.Icon />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="how-forest" id="how">
        <div
          className="how-forest-bg"
          style={{ backgroundImage: `url(${PHOTO_LIBRARY.forestfloor})` }}
          aria-hidden="true"
        />
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
              <h3>Quick & Easy Purchase</h3>
              <p>Choose monthly or annually, saving 16% with annual billing.</p>
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

      <section className="section cream pricing-band" id="pricing">
        <img className="botanical botanical-left" src="/images/botanical-corner.png" alt="" />
        <img className="botanical botanical-right" src="/images/botanical-corner.png" alt="" />
        <div className="wrap">
          <div className="section-head">
            <h2>Choose how you’d like to pay</h2>
            <div className="billing-toggle" role="group" aria-label="Billing">
              <button
                type="button"
                className={billing === "monthly" ? "selected" : ""}
                onClick={() => setBilling("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={billing === "annual" ? "selected" : ""}
                onClick={() => setBilling("annual")}
              >
                Annual
              </button>
            </div>
          </div>
          <div className="price-grid">
            <article className={`price-card ${billing === "annual" ? "has-badge" : ""}`}>
              <span className="price-corners" aria-hidden="true" />
              {billing === "annual" ? <span className="save-badge">Save $2/month</span> : null}
              <h3>Individual Plan</h3>
              {billing === "monthly" ? (
                <>
                  <div className="amount">{money(monthlyCents)} <small>/ month</small></div>
                  <p className="plan-line">1 Personal Checklist</p>
                </>
              ) : (
                <>
                  <div className="amount">{money(annualCents)} <small>/ year</small></div>
                  <p className="plan-line">1 Personal Checklist</p>
                  <p className="plan-save">Save 16% with annual billing</p>
                </>
              )}
              <ul>
                {coreFeatures.map((item) => (
                  <li key={item.label}>
                    <item.Icon />
                    {item.label}
                  </li>
                ))}
              </ul>
              <Link className="btn btn-primary btn-block" to={`/checkout?plan=individual&access=${billing}`}>
                Choose Individual
              </Link>
            </article>
            <article className={`price-card featured ${billing === "annual" ? "has-badge" : ""}`}>
              <span className="price-corners" aria-hidden="true" />
              {billing === "annual" ? <span className="save-badge">Save $2/month</span> : null}
              <h3>Family Plan</h3>
              <div className="amount">
                {money(family.subscriptionCents)}{" "}
                <small>{billing === "annual" ? "/ year" : "/ month"}</small>
              </div>
              <p className="plan-line">{familyQty} Personal Checklists</p>
              {billing === "annual" ? <p className="plan-save">Save 16% with annual billing</p> : null}
              <div className="qty-picker landing-qty">
                <span>People</span>
                <div>
                  <button type="button" className="btn btn-ghost" onClick={() => setFamilyQty((n) => Math.max(FAMILY_MIN_SEATS, n - 1))}>-</button>
                  <b>{familyQty}</b>
                  <button type="button" className="btn btn-ghost" onClick={() => setFamilyQty((n) => n + 1)}>+</button>
                </div>
              </div>
              <ul>
                <li><IconUser /> Every person gets their own checklist</li>
                <li><IconChecklist /> Connect checklists under one Family Plan</li>
                <li><IconNotes /> Each owner chooses View Only or Can Edit</li>
              </ul>
              <Link className="btn btn-primary btn-block" to={`/checkout?plan=family&qty=${familyQty}&access=${billing}`}>
                Choose Family
              </Link>
            </article>
          </div>
          <aside className="vault-cta-strip" id="survival-vault">
            <div>
              <p className="eyebrow">Optional upgrade</p>
              <h3>
                Survival Vault for an additional $10 <small>/ one time</small>
              </h3>
              <p>
                Extra checklists for off-grid systems, water purification, backup power, cooling and heat, long-term food,
                and more.
              </p>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => setVaultOpen(true)}>
              See details
            </button>
          </aside>
        </div>
      </section>

      <section className="section sand closing-cta" id="free-checklist">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Bonus checklist</p>
            <h2>Get your <span className="lead-free">FREE</span> Emergency Documents Checklist.</h2>
            <p>
              Sign up for our mailing list and get IDs, insurance, medical records, and the papers you’ll want in an
              emergency.
            </p>
          </div>
          <p className="closing-cta-action">
            <button className="btn btn-primary" type="button" onClick={() => setLeadOpen(true)}>
              Get <span className="lead-free-btn">FREE</span> Checklist
            </button>
          </p>
          <p className="muted lead-note">We never spam. Unsubscribe anytime.</p>
        </div>
      </section>

      {leadOpen ? (
        <ChecklistSignupModal
          alreadyJoined={leadDone}
          onClose={() => setLeadOpen(false)}
          onJoined={() => setLeadDone(true)}
        />
      ) : null}

      {vaultOpen ? (
        <SurvivalVaultModal
          ctaHref="#pricing"
          onClose={() => setVaultOpen(false)}
        />
      ) : null}

      <PublicFooter />
    </div>
  );
}
