export const MONTHLY_CENTS = 1199;
export const ANNUAL_MONTHLY_EQUIVALENT_CENTS = 999;
export const ANNUAL_CENTS = 11988;
export const SURVIVAL_VAULT_CENTS = 1000;
export const SURVIVAL_VAULT_NAME = "Survival Vault";
export const SURVIVAL_VAULT_DESCRIPTION =
  "Off-grid systems, water purification, backup battery and solar, emergency heating and cooling, long-term food, and How-To Videos. $10 one time, not $10 per person. Does not renew.";
export const FAMILY_MIN_SEATS = 2;
export const ANNUAL_SAVINGS_PER_PERSON_YEAR_CENTS = 2400;
export const LAUNCH_PROBE_TOKEN = "spl-dollar";
export const LAUNCH_PROBE_CENTS = 100;

export const ACCESS_MONTHLY_CENTS = MONTHLY_CENTS;
export const ACCESS_ANNUAL_CENTS = ANNUAL_CENTS;

export type AccessInterval = "monthly" | "annual";

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
  const seats = Math.max(1, Math.floor(people) || 1);
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
