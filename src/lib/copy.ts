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

export const COMPLETION_STANDARD =
  "Checked means available, accessible, compatible, current, known, and practiced. Buying an item is not enough.";

export const OFFICIAL_GUIDANCE_DISCLAIMER =
  "No checklist replaces local emergency-management instructions, professional medical advice, utility guidance, or emergency services. Follow evacuation orders and official public-health instructions first.";

export const QUICK_START_BANNER =
  "This is a priority session. It does not mean every preparedness item can be finished in these minutes.";

export function quickStartIntro(minutes: number) {
  return `About ${minutes} minutes for the priority items, once supplies are gathered. ${QUICK_START_BANNER} ${COMPLETION_STANDARD}`;
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
