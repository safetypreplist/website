export const OFFICIAL_GUIDANCE_DISCLAIMER =
  "This list is general guidance. Always follow instructions from local emergency officials, evacuation orders, and emergency services first.";

export const QUICK_START_BANNER =
  "Gather what you already own, then pack. Anything missing goes on your shopping list.";

export function quickStartIntro(minutes: number) {
  return `About ${minutes} minutes once supplies are gathered. ${QUICK_START_BANNER} ${OFFICIAL_GUIDANCE_DISCLAIMER}`;
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
