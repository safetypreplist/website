// DRAFT — requires attorney review before launch.

const PLACEHOLDER = /^\[[A-Za-z0-9 /,_.:'-]+\]$/;

export const LEGAL = {
  legalName: "SafetyPrepList.com",
  brandName: "Safety Prep List",
  brandMethod: "The Ready Method",
  supportEmail: "info@safetypreplist.com",
  governingState: "[STATE]",
  governingCountry: "[COUNTRY]",
  effectiveDate: "October 5, 2026",
  refundPolicy:
    "7-day refund on a first purchase if requested through the contact form. No partial-period refunds on renewals.",
  arbitration: "[ARBITRATION / VENUE CLAUSE: leave as TODO for attorney review]",
  gdpr: "[GDPR / EU PRIVACY LANGUAGE: leave as TODO for attorney review]",
} as const;

export const LEGAL_VERSIONS = {
  terms: "2026-10-05",
  privacy: "2026-10-05",
  refunds: "2026-10-05",
} as const;

export type LegalAcceptanceContext = "checkout" | "signup" | "email_signup" | "in_app_ack" | "terms_update";

export function isLegalPlaceholder(value: string) {
  return PLACEHOLDER.test(value.trim());
}

export function unfinishedLegalFields() {
  return (Object.entries(LEGAL) as [keyof typeof LEGAL, string][]).filter(([, value]) => isLegalPlaceholder(value));
}

export function displayLegal(value: string) {
  return isLegalPlaceholder(value) ? `TODO: fill ${value}` : value;
}

export function legalMailto(subject?: string) {
  const email = isLegalPlaceholder(LEGAL.supportEmail) ? "info@safetypreplist.com" : LEGAL.supportEmail;
  const url = new URL(`mailto:${email}`);
  if (subject) url.searchParams.set("subject", subject);
  return url.toString();
}

export function copyrightLine(year = new Date().getFullYear()) {
  return `© ${year} ${LEGAL.legalName}.`;
}

export function printDisclaimer() {
  return `General guidance only. Follow local emergency officials first. © ${LEGAL.legalName}.`;
}

export const NOTE_SENSITIVITY_WARNING =
  "Do not store passwords, PINs, full Social Security numbers, or financial account numbers in notes.";

export const GUIDANCE_ACK =
  "This is general guidance. Follow local emergency officials first. Verify product instructions and local rules.";

export const AGREEMENT_LABEL =
  "I agree to the Terms of Service, Privacy Policy, and Refund Policy, and I understand this is general guidance and not professional advice.";
