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
  IconSolar,
  IconTablet,
  IconUser,
  IconWater,
  IconFood,
  MarkImg,
} from "../components/Icons";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { money } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import { DeviceStage } from "../components/DeviceStage";
import { HeroSlider } from "../components/HeroSlider";
import { StoryVideo } from "../components/StoryVideo";
import {
  ANNUAL_CENTS,
  FAMILY_MIN_SEATS,
  MAX_CHECKLIST_QUANTITY,
  PUBLIC_ACCESS,
  SURVIVAL_VAULT_CENTS,
  checkoutBreakdown,
} from "../lib/pricing";
import { HERO_TAGLINE_LEAD, HERO_TAGLINE_REST, SCOPE_SUPPORT, VAULT_CHECKLISTS } from "../lib/copy";
import { INCLUDED_CUSTOM_PER_SECTION } from "../lib/customItems";
import { useApp } from "../context/AppContext";

const primarySystems = [
  {
    minutes: 5,
    mark: "backpack" as const,
    title: "Grab-and-Go Bag",
    line: "A backpack by the exit with essential items for a quick departure.",
  },
  {
    minutes: 15,
    mark: "duffel" as const,
    title: "Ready Duffel Bag",
    line: "A 72-hour preparedness kit tailored to your household’s needs.",
  },
  {
    minutes: 20,
    mark: "vehicle" as const,
    title: "Vehicle or Suitcase Prep",
    line: "Prepare your vehicle for emergencies or pack a suitcase for evacuation.",
  },
  {
    minutes: 60,
    mark: "home" as const,
    title: "Home Resilience",
    line: "Prioritize essential supplies and systems to keep your household prepared at home.",
  },
];

const vaultIcons = {
  "Off-Grid Systems": IconOffgrid,
  "Water Purification": IconWater,
  "Home Battery & Solar": IconSolar,
  "Emergency Cooling / Heat Resilience": IconHeat,
  "Long-Term Food": IconFood,
} as const;

const coreFeatures = [
  { label: "Grab-and-Go Bag", Icon: IconBackpack },
  { label: "Ready Duffel Bag", Icon: IconDuffel },
  { label: "Vehicle or Suitcase Prep", Icon: IconCar },
  { label: "Home Resilience", Icon: IconHouse },
  { label: `Up to ${INCLUDED_CUSTOM_PER_SECTION} custom items per section`, Icon: IconNotes },
];

const planIncludes = [
  { label: "Check off items on any device", Icon: IconPhone },
  { label: "Works offline too", Icon: IconOffgrid },
  { label: "Add personal notes", Icon: IconNotes },
  { label: `Up to ${INCLUDED_CUSTOM_PER_SECTION} custom items per section`, Icon: IconChecklist },
  { label: "Print any checklist", Icon: IconPrint },
  { label: "Family sharing on the Family Plan", Icon: IconUser },
];

export function LandingPage() {
  const { products, session, myChecklist } = useApp();
  const addingChecklists = Boolean(
    session && myChecklist?.status === "active" && myChecklist.ownerUserId === session.user.id,
  );
  const minFamilyQty = addingChecklists ? 1 : FAMILY_MIN_SEATS;
  const annual = products.find((p) => p.slug === "access_annual");
  const annualCents = annual?.amount_cents ?? ANNUAL_CENTS;
  const vaultProduct = products.find((p) => p.slug === "upgrade_full");
  const vaultCents = vaultProduct?.amount_cents ?? SURVIVAL_VAULT_CENTS;
  const [familyQty, setFamilyQty] = useState(FAMILY_MIN_SEATS);
  const [vaultOpen, setVaultOpen] = useState(false);
  const family = checkoutBreakdown(familyQty, PUBLIC_ACCESS, false);

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

  return (
    <div className="marketing-page">
      <PublicHeader pricingHref="#pricing" />

      <section className="hero-studio">
        <div className="hero-devices">
          <DeviceStage />
        </div>
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
            <a className="btn btn-primary" href="#pricing">Get Safety Prep List</a>
            <p className="hero-price-note">
              <b>{money(annualCents)}/year</b> per checklist · Survival Vault {money(vaultCents)} one time
            </p>
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
            <DeviceStage />
            <StoryVideo />
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
            <Link className="sample-link" to="/demo">
              Try a sample checklist
            </Link>
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
              <p>Individual or Family — {money(annualCents)} per Personal Checklist for the year.</p>
            </li>
            <li>
              <span className="how-icon">
                <MarkImg name="bag" />
              </span>
              <span className="step-num">Step 2</span>
              <h3>Pay once for the year</h3>
              <p>Secure checkout. One yearly payment. Optional Survival Vault is a $10 one-time add-on.</p>
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
            <h2>One price. One year.</h2>
            <p className="pricing-lead">
              {money(annualCents)} per Personal Checklist for the year. No monthly subscription.
            </p>
          </div>
          <div className="price-grid">
            <article className="price-card has-badge">
              <span className="price-corners" aria-hidden="true" />
              <span className="save-badge">Per checklist / year</span>
              <h3>Individual Plan</h3>
              <div className="amount">{money(annualCents)} <small>/ year</small></div>
              <p className="plan-line">1 Personal Checklist · about {money(Math.round(annualCents / 12))}/mo if you use it all year</p>
              <p className="plan-save">Pay once. You’re set for the year.</p>
              <ul>
                {coreFeatures.map((item) => (
                  <li key={item.label}>
                    <item.Icon />
                    {item.label}
                  </li>
                ))}
              </ul>
              <Link className="btn btn-primary btn-block" to="/checkout?plan=individual&access=annual">
                Choose Individual
              </Link>
            </article>
            <article className="price-card featured has-badge">
              <span className="price-corners" aria-hidden="true" />
              <span className="save-badge">{money(annualCents)} × each person</span>
              <h3>{addingChecklists ? "Add Checklists" : "Family Plan"}</h3>
              <div className="amount">
                {money(family.subscriptionCents)} <small>/ year</small>
              </div>
              <p className="plan-line">
                {addingChecklists
                  ? `${familyQty} Additional Checklist${familyQty === 1 ? "" : "s"}. Your own checklist is already included.`
                  : `${familyQty} Personal Checklists`}
              </p>
              <p className="plan-save">{money(annualCents)} per person for the year.</p>
              <div className="qty-picker landing-qty">
                <span>{addingChecklists ? "Additional Checklists" : "Family Members"}</span>
                <div>
                  <button type="button" className="btn btn-ghost" onClick={() => setFamilyQty((n) => Math.max(minFamilyQty, n - 1))}>-</button>
                  <b>{familyQty}</b>
                  <button type="button" className="btn btn-ghost" disabled={familyQty >= MAX_CHECKLIST_QUANTITY} onClick={() => setFamilyQty((n) => Math.min(MAX_CHECKLIST_QUANTITY, n + 1))}>+</button>
                </div>
              </div>
              <p className="plan-plus">Everything in Individual, plus:</p>
              <ul>
                <li><IconUser /> Each member gets their own Personal Checklist</li>
                <li><IconChecklist /> Connected under one Family Plan</li>
                <li><IconNotes /> View Only or Can Edit permissions per owner</li>
              </ul>
              <Link className="btn btn-primary btn-block" to={`/checkout?plan=family&qty=${familyQty}&access=annual`}>
                {addingChecklists ? "Add Checklists" : "Choose Family"}
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
              <p className="eyebrow">One-time add-on</p>
              <h3>
                Survival Vault · {money(vaultCents)} <small>one time</small>
              </h3>
              <p>
                Expand your checklist with Off-Grid Systems, Water Purification, Home Battery &amp; Solar, Emergency Cooling / Heat Resilience, and Long-Term Food. Does not renew.
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
