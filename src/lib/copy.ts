export const HERO_TAGLINE_LEAD = "The Perfect Checklists for";
export const HERO_TAGLINE_REST = "Emergency Situations.";
export const HERO_TAGLINE = `${HERO_TAGLINE_LEAD} ${HERO_TAGLINE_REST}`;
export const FOOTER_TAGLINE = "Hope for the best, Prepare for the rest.";

export const PAGE_TITLE = `Safety Prep List — ${HERO_TAGLINE}`;
export const SITE_ORIGIN = "https://safetypreplist.com";
export const SITE_DESCRIPTION =
  "Practical emergency checklists as a one-time purchase. Basic $12.99 or Pro $24.99 — works offline on one device.";

export const SCOPE_LINE =
  "Practical preparedness for natural disasters, local emergencies, outages, evacuations, and temporary disruptions.";

export const SCOPE_SUPPORT = "Each list includes optional extras for building on the essentials.";

export const CORE_MESSAGE = "Start small. Prepare practically. Build over time.";

export const MORE_TIME_LINE =
  "You've handled the essentials. Now build a stronger preparedness system.";

export const BASIC_LICENSE_DESCRIPTION =
  "One-time purchase, lifetime access to the core checklists: Grab-and-Go Bag, Ready Duffel Bag, Vehicle or Suitcase Prep, and Home Resilience. Works offline on one device.";

export const PRO_LICENSE_DESCRIPTION =
  "One-time purchase, lifetime access to everything in Basic, plus off-grid, water, power, and long-term food checklists. Works offline on one device.";

export const ONE_LICENSE_ONE_DEVICE_LINE =
  "One license covers one device.";

/** Extra checklists included with Pro (not a separate product). */
export const PRO_EXTRA_CHECKLISTS = [
  {
    title: "Off-Grid Systems",
    line: "Stay capable when the grid is down.",
    detail: "Low tech tools, sanitation, alternative cooking, and manual household systems for days without utilities.",
  },
  {
    title: "Water Purification",
    line: "Store, filter, and treat what you drink.",
    detail: "Storage, filtration, purification, rotation, and emergency collection beyond the bottles in the pantry.",
  },
  {
    title: "Home Battery & Solar",
    line: "Keep essential loads running.",
    detail: "Plan battery capacity, solar input, safe charging, and which devices actually matter overnight.",
  },
  {
    title: "Emergency Cooling / Heat Resilience",
    line: "Stay safe in extreme temperatures.",
    detail: "Blackout cooling, shaded rooms, hydration, and safe warmth when HVAC is not an option.",
  },
  {
    title: "Long-Term Food",
    line: "A pantry built for weeks, not a weekend.",
    detail: "Staples, rotation, preservation, and manual food prep for the stretch after the first few days.",
  },
] as const;

/** @deprecated Use PRO_EXTRA_CHECKLISTS */
export const VAULT_CHECKLISTS = PRO_EXTRA_CHECKLISTS;

export const COMPLETION_STANDARD =
  "Checked means available, accessible, compatible, current, known, and practiced. Buying an item is not enough.";

export const OFFICIAL_GUIDANCE_DISCLAIMER =
  "No checklist replaces local emergency-management instructions, professional medical advice, utility guidance, or emergency services. Follow evacuation orders and official public-health instructions first.";

export const QUICK_START_BANNER =
  "This is a priority session. It does not mean every preparedness item can be finished in these minutes.";

const RETIRED_ACCOUNT_COPY =
  /\b(account|password|log ?in|logins?|sign ?in|family plan|checklist id|across devices|my devices)\b/i;

/** Owner-saved copy from the retired account-based app must not reach the license-based, local-first app. */
export function isRetiredAccountCopy(...texts: string[]) {
  return texts.some((text) => RETIRED_ACCOUNT_COPY.test(text));
}

export function quickStartIntro(minutes: number) {
  return `About ${minutes} minutes for the priority items, once supplies are gathered. ${QUICK_START_BANNER}`;
}

export function annualSavingsPercent(monthlyCents: number, annualCents: number) {
  const twelveMonths = monthlyCents * 12;
  if (twelveMonths <= 0 || annualCents >= twelveMonths) return 0;
  return Math.round((1 - annualCents / twelveMonths) * 1000) / 10;
}

export function quickStartMinutes(timeLabel: string | null | undefined) {
  if (!timeLabel || /full/i.test(timeLabel)) return null;
  const match = timeLabel.match(/\d+/);
  return match ? Number(match[0]) : null;
}
