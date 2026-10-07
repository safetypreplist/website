import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
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
  IconTablet,
  IconUser,
  IconWater,
  MarkImg,
} from "../components/Icons";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
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
import { annualSavingsPercent, CORE_MESSAGE, HERO_TAGLINE_LEAD, HERO_TAGLINE_REST, PAGE_TITLE, SCOPE_SUPPORT } from "../lib/copy";
import { INCLUDED_CUSTOM_PER_SECTION } from "../lib/customItems";
import { useApp } from "../context/AppContext";

const primarySystems = [
  {
    minutes: 5,
    mark: "backpack" as const,
    title: "5-Minute Grab-and-Go Bag",
    line: "A backpack near the exit. The minimum critical layer.",
  },
  {
    minutes: 15,
    mark: "duffel" as const,
    title: "15-Minute Ready Duffel",
    line: "72-Hour Continuity Kit, adjusted for your household.",
  },
  {
    minutes: 20,
    mark: "vehicle" as const,
    title: "20-Minute Vehicle OR Suitcase Prep",
    line: "Choose a vehicle kit or an evacuation suitcase.",
  },
  {
    minutes: 60,
    mark: "home" as const,
    title: "60-Minute Home Resilience",
    line: "The highest-priority safety and continuity needs at home.",
  },
];

const moreTopics = [
  {
    title: "Water, food, and power",
    line: "Storage, treatment, cooking, and fuel safety when you have more time.",
    Icon: IconWater,
  },
  {
    title: "Weather and hazards",
    line: "Wildfire, flood, earthquake, wind, and severe weather planning.",
    Icon: IconHeat,
  },
  {
    title: "People, pets, and recovery",
    line: "Medical continuity, caregivers, documents, and getting back to normal.",
    Icon: IconNotes,
  },
  {
    title: "Where you live",
    line: "Rural and off-grid property, or an apartment and shared building.",
    Icon: IconOffgrid,
  },
  {
    title: "Home systems",
    line: "Sanitation, cooling, heat, and a stronger household plan.",
    Icon: IconHouse,
  },
];

const coreFeatures = [
  { label: "5-Minute Grab-and-Go Bag", Icon: IconBackpack },
  { label: "15-Minute Ready Duffel", Icon: IconDuffel },
  { label: "20-Minute Vehicle OR Suitcase Prep", Icon: IconCar },
  { label: "60-Minute Home Resilience", Icon: IconHouse },
  { label: `Up to ${INCLUDED_CUSTOM_PER_SECTION} custom items per section`, Icon: IconNotes },
];

const planIncludes = [
  { label: "Check off items on any device", Icon: IconPhone },
  { label: "Add personal notes", Icon: IconNotes },
  { label: `Up to ${INCLUDED_CUSTOM_PER_SECTION} custom items per section`, Icon: IconChecklist },
  { label: "Print any checklist", Icon: IconPrint },
  { label: "Family sharing on the Family Plan", Icon: IconUser },
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
  const family = checkoutBreakdown(familyQty, billing, false);
  const annualSavePct = annualSavingsPercent(monthlyCents, annualCents);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

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
            <p className="lead">
              {SCOPE_SUPPORT} {CORE_MESSAGE}
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
              {moreTopics.map((item) => (
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

      <section className="section forest pricing-band" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2>Choose a Plan</h2>
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
                {annualSavePct > 0 ? <small className="billing-save">Save {annualSavePct}%</small> : null}
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
                  {annualSavePct > 0 ? <p className="plan-save">Save {annualSavePct}% with annual billing</p> : null}
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
              {billing === "annual" && annualSavePct > 0 ? <p className="plan-save">Save {annualSavePct}% with annual billing</p> : null}
              <div className="qty-picker landing-qty">
                <span>Family Members</span>
                <div>
                  <button type="button" className="btn btn-ghost" onClick={() => setFamilyQty((n) => Math.max(FAMILY_MIN_SEATS, n - 1))}>-</button>
                  <b>{familyQty}</b>
                  <button type="button" className="btn btn-ghost" onClick={() => setFamilyQty((n) => n + 1)}>+</button>
                </div>
              </div>
              <p className="plan-plus">Everything in Individual, plus:</p>
              <ul>
                <li><IconUser /> Each member gets their own Personal Checklist</li>
                <li><IconChecklist /> Connected under one Family Plan</li>
                <li><IconNotes /> View Only or Can Edit permissions per owner</li>
              </ul>
              <Link className="btn btn-primary btn-block" to={`/checkout?plan=family&qty=${familyQty}&access=${billing}`}>
                Choose Family
              </Link>
            </article>
          </div>
          <div className="plan-includes">
            <p className="eyebrow">What’s included with your plan</p>
            <ul>
              {planIncludes.map((item) => (
                <li key={item.label}>
                  <item.Icon />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <aside className="vault-cta-strip" id="survival-vault">
            <div>
              <p className="eyebrow">Optional add-on</p>
              <h3>
                Survival Vault for an additional $10 <small>/ one time</small>
              </h3>
              <p>
                Expand your checklist to include Off-Grid Systems, Water Purification, Home Battery &amp; Solar, Emergency Cooling / Heat Resilience, and Long-Term Food. How-To Videos are a collection of external playlists we share.
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
          ctaHref="#pricing"
          onClose={() => setVaultOpen(false)}
        />
      ) : null}

      <PublicFooter />
    </div>
  );
}
