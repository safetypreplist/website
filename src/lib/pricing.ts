/** Public offer: $30 per Personal Checklist per year. Monthly kept only for legacy accounts. */
export const MONTHLY_CENTS = 799;
export const ANNUAL_MONTHLY_EQUIVALENT_CENTS = 250;
export const ANNUAL_CENTS = 3000;
export const SURVIVAL_VAULT_CENTS = 1000;
export const SURVIVAL_VAULT_NAME = "Survival Vault";
export const SURVIVAL_VAULT_DESCRIPTION =
  "For an extra $10/year, unlock Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, and Long-Term Food.";
export const FAMILY_MIN_SEATS = 2;
export const MAX_CHECKLIST_QUANTITY = 20;

export const ACCESS_MONTHLY_CENTS = MONTHLY_CENTS;
export const ACCESS_ANNUAL_CENTS = ANNUAL_CENTS;

/** New purchases are annual only. */
export type AccessInterval = "monthly" | "annual";
export const PUBLIC_ACCESS: AccessInterval = "annual";

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

export function checkoutBreakdown(people: number, access: AccessInterval = PUBLIC_ACCESS, includeVault = false) {
  const seats = Math.min(MAX_CHECKLIST_QUANTITY, Math.max(1, Math.floor(people) || 1));
  const subscriptionCents = seats * subscriptionUnitCents(access);
  const vaultCents = includeVault ? SURVIVAL_VAULT_CENTS : 0;
  return {
    seats,
    subscriptionCents,
    vaultCents,
    dueTodayCents: subscriptionCents + vaultCents,
    // Vault renews with the plan (yearly add-on).
    recurringCents: subscriptionCents + vaultCents,
    interval: access,
    unitCents: subscriptionUnitCents(access),
    monthlyEquivalentCents: access === "annual" ? ANNUAL_MONTHLY_EQUIVALENT_CENTS : MONTHLY_CENTS,
  };
}

export function memberAddBreakdown(access: AccessInterval = PUBLIC_ACCESS) {
  return checkoutBreakdown(1, access, false);
}

export function nextRenewalDate(from: Date, interval: AccessInterval) {
  const next = new Date(from);
  if (interval === "annual") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
