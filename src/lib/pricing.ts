export const MONTHLY_CENTS = 799;
export const ANNUAL_MONTHLY_EQUIVALENT_CENTS = 667;
export const ANNUAL_CENTS = 7999;
export const SURVIVAL_VAULT_CENTS = 1000;
export const SURVIVAL_VAULT_NAME = "Survival Vault";
export const SURVIVAL_VAULT_DESCRIPTION =
  "Unlock Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, Long-Term Food, and How-To Videos. How-To Videos is a curated YouTube playlist from independent creators and organizations. $10 one time, not $10 per person. Does not renew.";
export const FAMILY_MIN_SEATS = 2;
export const MAX_CHECKLIST_QUANTITY = 20;
export const LAUNCH_CODE = "LAUNCH26";
export const LAUNCH_FIRST_MONTH_CENTS = 499;

export const ACCESS_MONTHLY_CENTS = MONTHLY_CENTS;
export const ACCESS_ANNUAL_CENTS = ANNUAL_CENTS;

export type AccessInterval = "monthly" | "annual";

/** What a year of monthly billing costs versus annual billing, per Personal Checklist. */
export function annualSavings(monthlyCents = MONTHLY_CENTS, annualCents = ANNUAL_CENTS) {
  const yearOfMonthlyCents = monthlyCents * 12;
  const savedCents = Math.max(0, yearOfMonthlyCents - annualCents);
  const percent = yearOfMonthlyCents ? Math.round((savedCents / yearOfMonthlyCents) * 1000) / 10 : 0;
  return { yearOfMonthlyCents, savedCents, percent };
}

export function subscriptionUnitCents(interval: AccessInterval) {
  return interval === "annual" ? ANNUAL_CENTS : MONTHLY_CENTS;
}

export function accessAmountCents(interval: AccessInterval) {
  return subscriptionUnitCents(interval);
}

export function accessProductSlug(interval: AccessInterval) {
  return interval === "annual" ? "access_annual" : "access_monthly";
}

export function checkoutBreakdown(people: number, access: AccessInterval, includeVault: boolean) {
  const seats = Math.min(MAX_CHECKLIST_QUANTITY, Math.max(1, Math.floor(people) || 1));
  const subscriptionCents = seats * subscriptionUnitCents(access);
  const vaultCents = includeVault ? SURVIVAL_VAULT_CENTS : 0;
  return {
    seats,
    subscriptionCents,
    vaultCents,
    dueTodayCents: subscriptionCents + vaultCents,
    recurringCents: subscriptionCents,
    interval: access,
    unitCents: subscriptionUnitCents(access),
    monthlyEquivalentCents: access === "annual" ? ANNUAL_MONTHLY_EQUIVALENT_CENTS : MONTHLY_CENTS,
  };
}

export function memberAddBreakdown(access: AccessInterval) {
  return checkoutBreakdown(1, access, false);
}

export function nextRenewalDate(from: Date, interval: AccessInterval) {
  const next = new Date(from);
  if (interval === "annual") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
