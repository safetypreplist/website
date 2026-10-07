export const HERO_TAGLINE_LEAD = "The Perfect Checklists for";
export const HERO_TAGLINE_REST = "Emergency Situations.";
export const HERO_TAGLINE = `${HERO_TAGLINE_LEAD} ${HERO_TAGLINE_REST}`;
export const FOOTER_TAGLINE = "Hope for the best, Prepare for the rest.";

export const PAGE_TITLE = `Safety Prep List — ${HERO_TAGLINE}`;

export const SCOPE_LINE =
  "Practical preparedness for natural disasters, local emergencies, outages, evacuations, and temporary disruptions.";

export const SCOPE_SUPPORT =
  "Start with the essentials. Build your preparedness system as you have more time.";

export const CORE_MESSAGE = "Start small. Prepare practically. Build over time.";

export const MORE_TIME_LINE =
  "You've handled the essentials. Now build a stronger preparedness system.";

export const VAULT_APP_DESCRIPTION =
  "Unlock Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, Long-Term Food, and How-To Videos. How-To Videos are a collection of external playlists we share. $10 one time, not $10 per person. Does not renew.";

export const VAULT_CHECKLISTS = [
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
  {
    title: "How-To Videos",
    line: "Watch the skills when you need them.",
    detail: "Practical visual learning for water, power, off grid, food, communications, and home readiness.",
  },
] as const;

export const COMPLETION_STANDARD =
  "Checked means available, accessible, compatible, current, known, and practiced. Buying an item is not enough.";

export const OFFICIAL_GUIDANCE_DISCLAIMER =
  "No checklist replaces local emergency-management instructions, professional medical advice, utility guidance, or emergency services. Follow evacuation orders and official public-health instructions first.";

export const QUICK_START_BANNER =
  "This is a priority session. It does not mean every preparedness item can be finished in these minutes.";

export function quickStartIntro(minutes: number) {
  return `About ${minutes} minutes for the priority items, once supplies are gathered. ${QUICK_START_BANNER}`;
}

export function annualSavingsPercent(monthlyCents: number, annualCents: number) {
  const twelveMonths = monthlyCents * 12;
  if (twelveMonths <= 0 || annualCents >= twelveMonths) return 0;
  return Math.round((1 - annualCents / twelveMonths) * 100);
}

export function quickStartMinutes(timeLabel: string | null | undefined) {
  if (!timeLabel || /full/i.test(timeLabel)) return null;
  const match = timeLabel.match(/\d+/);
  return match ? Number(match[0]) : null;
}
