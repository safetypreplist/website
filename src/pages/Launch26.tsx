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
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { HERO_TAGLINE_LEAD, HERO_TAGLINE_REST, SCOPE_SUPPORT, VAULT_CHECKLISTS } from "../lib/copy";
import { money } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import { DeviceStage } from "../components/DeviceStage";
import { HeroSlider } from "../components/HeroSlider";
import { StoryVideo } from "../components/StoryVideo";
import {
  ANNUAL_CENTS,
  FAMILY_MIN_SEATS,
  LAUNCH_CODE,
  LAUNCH_FIRST_MONTH_CENTS,
  MAX_CHECKLIST_QUANTITY,
  MONTHLY_CENTS,
} from "../lib/pricing";
import { INCLUDED_CUSTOM_PER_SECTION } from "../lib/customItems";

const CODE = LAUNCH_CODE;
const INDIVIDUAL_CENTS = MONTHLY_CENTS;
const INDIVIDUAL_FIRST_CENTS = LAUNCH_FIRST_MONTH_CENTS;
const FIRST_MONTH = money(LAUNCH_FIRST_MONTH_CENTS);

function checkoutHref(query: string) {
  return `/checkout?${query}&code=${CODE}&from=launch26`;
}

function rememberLaunchVisit() {
  try {
    sessionStorage.setItem("spl.launch26", "1");
  } catch {
    // Private browsing can refuse storage; the checkout URL still carries from=launch26.
  }
}

const primarySystems = [
  {
    minutes: 5,
    mark: "backpack" as const,
    title: "5-Minute Grab-and-Go Bag",
    line: "A backpack by the exit with essential items for a quick departure.",
  },
  {
    minutes: 15,
    mark: "duffel" as const,
    title: "15-Minute Ready Duffel (72-Hour Continuity Kit)",
    line: "A 72-hour preparedness kit tailored to your household’s needs.",
  },
  {
    minutes: 20,
    mark: "vehicle" as const,
    title: "20-Minute Vehicle OR Suitcase Prep",
    line: "Prepare your vehicle for emergencies or pack a suitcase for evacuation.",
  },
  {
    minutes: 60,
    mark: "home" as const,
    title: "60-Minute Home Resilience",
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

const individualFeatures = [
  { label: "5-Minute Grab-and-Go Bag", Icon: IconBackpack },
  { label: "15-Minute Ready Duffel (72-Hour Continuity Kit)", Icon: IconDuffel },
  { label: "20-Minute Vehicle OR Suitcase Prep", Icon: IconCar },
  { label: "60-Minute Home Resilience", Icon: IconHouse },
  { label: `Up to ${INCLUDED_CUSTOM_PER_SECTION} custom items per section`, Icon: IconNotes },
];

export function Launch26Page() {
  const [vaultOpen, setVaultOpen] = useState(false);
  const [familyQty, setFamilyQty] = useState(FAMILY_MIN_SEATS);
  const familyCents = MONTHLY_CENTS * familyQty;
  const familyFirstCents = LAUNCH_FIRST_MONTH_CENTS * familyQty;

  useEffect(() => {
    rememberLaunchVisit();
  }, []);

  return (
    <div className="marketing-page launch-page">
      <PublicHeader howHref="#how" includedHref="#included" pricingHref="#plans" />

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
            <a className="btn btn-primary" href="#plans">
              Claim Your {FIRST_MONTH} First Month
            </a>
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
              <p>Check out securely. This launch price is for Monthly billing.</p>
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
            <h2>Save 50% off your first month</h2>
            <p>
              Pay just {FIRST_MONTH} per Personal Checklist for your first month. Your subscription renews at the regular rate of {money(INDIVIDUAL_CENTS)} per checklist per month thereafter.
            </p>
          </div>
          <div className="price-grid">
            <article className="price-card">
              <span className="price-corners" aria-hidden="true" />
              <h3>Individual Plan</h3>
              <p className="launch-was">
                <span>Regular price</span>
                <s>{money(INDIVIDUAL_CENTS)}/month</s>
              </p>
              <Link className="amount" to={checkoutHref("plan=individual&access=monthly")}>
                {money(INDIVIDUAL_FIRST_CENTS)} <small>first month</small>
              </Link>
              <p className="launch-off">Then {money(INDIVIDUAL_CENTS)}/month</p>
              <p className="plan-line">1 Personal Checklist</p>
              <ul>
                {individualFeatures.map((item) => (
                  <li key={item.label}>
                    <item.Icon />
                    {item.label}
                  </li>
                ))}
              </ul>
              <Link className="btn btn-primary btn-block" to={checkoutHref("plan=individual&access=monthly")}>
                Choose Individual
              </Link>
            </article>
            <article className="price-card featured">
              <span className="price-corners" aria-hidden="true" />
              <h3>Family Plan</h3>
              <p className="launch-was">
                <span>Regular price</span>
                <s>{money(familyCents)}/month</s>
              </p>
              <Link className="amount" to={checkoutHref(`plan=family&qty=${familyQty}&access=monthly`)}>
                {money(familyFirstCents)} <small>first month</small>
              </Link>
              <p className="launch-off">{FIRST_MONTH} per checklist, then {money(familyCents)}/month</p>
              <p className="plan-line">{familyQty} Personal Checklists</p>
              <div className="qty-picker landing-qty">
                <span>Family Members</span>
                <div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label="One fewer family member"
                    disabled={familyQty <= FAMILY_MIN_SEATS}
                    onClick={() => setFamilyQty((n) => Math.max(FAMILY_MIN_SEATS, n - 1))}
                  >
                    -
                  </button>
                  <b>{familyQty}</b>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label="One more family member"
                    disabled={familyQty >= MAX_CHECKLIST_QUANTITY}
                    onClick={() => setFamilyQty((n) => Math.min(MAX_CHECKLIST_QUANTITY, n + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="plan-plus">Everything in Individual, plus:</p>
              <ul>
                <li><IconUser /> Each member gets their own Personal Checklist</li>
                <li><IconChecklist /> Connected under one Family Plan</li>
                <li><IconNotes /> View Only or Can Edit permissions per owner</li>
              </ul>
              <Link
                className="btn btn-primary btn-block"
                to={checkoutHref(`plan=family&qty=${familyQty}&access=monthly`)}
              >
                Choose Family
              </Link>
            </article>
          </div>
          <p className="launch-billing-note">
            Introductory price for the first month on Monthly billing only. Regular monthly pricing applies beginning in month two. Annual billing is {money(ANNUAL_CENTS)}/year.
          </p>
          <aside className="vault-cta-strip" id="survival-vault">
            <div>
              <p className="eyebrow">Optional add-on</p>
              <h3>
                Survival Vault for an additional $10 <small>/ one time</small>
              </h3>
              <p>
                Expand your checklist to include Off-Grid Systems, Water Purification, Home Battery &amp; Solar, Emergency Cooling / Heat Resilience, and Long-Term Food.
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
          ctaHref={checkoutHref("plan=individual&access=monthly&vault=1")}
          onClose={() => setVaultOpen(false)}
        />
      ) : null}

      <PublicFooter howHref="#how" includedHref="#included" pricingHref="#plans" />
    </div>
  );
}
