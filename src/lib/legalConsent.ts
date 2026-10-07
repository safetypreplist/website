import { LEGAL_VERSIONS, type LegalAcceptanceContext } from "./legal";
import { invokeFunction, isSupabaseConfigured } from "./supabase";

const LOCAL_KEY = "spl.legal.acceptances";
const GUIDANCE_KEY = "spl.guidance-ack";
const COOKIE_KEY = "spl.cookie-consent";

export type StoredAcceptance = {
  terms_version: string;
  privacy_version: string;
  refund_version: string;
  accepted_at: string;
  context: LegalAcceptanceContext;
};

function readLocal(): StoredAcceptance[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as StoredAcceptance[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: StoredAcceptance[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
}

export function latestLocalAcceptance() {
  return readLocal().at(-1) ?? null;
}

export function hasCurrentLegalAcceptance() {
  const latest = latestLocalAcceptance();
  return Boolean(
    latest &&
      latest.terms_version === LEGAL_VERSIONS.terms &&
      latest.privacy_version === LEGAL_VERSIONS.privacy &&
      latest.refund_version === LEGAL_VERSIONS.refunds,
  );
}

export function storeLocalAcceptance(context: LegalAcceptanceContext) {
  const row: StoredAcceptance = {
    terms_version: LEGAL_VERSIONS.terms,
    privacy_version: LEGAL_VERSIONS.privacy,
    refund_version: LEGAL_VERSIONS.refunds,
    accepted_at: new Date().toISOString(),
    context,
  };
  writeLocal([...readLocal(), row]);
  return row;
}

export async function recordLegalAcceptance(context: LegalAcceptanceContext, email?: string) {
  const row = storeLocalAcceptance(context);
  if (!isSupabaseConfigured()) return row;
  try {
    await invokeFunction("record-terms-acceptance", {
      context,
      email: email || undefined,
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      refundVersion: LEGAL_VERSIONS.refunds,
    });
  } catch {
    /* Recording is best-effort when the function is not deployed yet. */
  }
  return row;
}

export function hasGuidanceAck() {
  return localStorage.getItem(GUIDANCE_KEY) === LEGAL_VERSIONS.terms;
}

export function storeGuidanceAck() {
  localStorage.setItem(GUIDANCE_KEY, LEGAL_VERSIONS.terms);
}

export const SCOPE_ACK_VERSION = "2026-10-06";
const SCOPE_KEY = "spl.scope-ack";

export type ScopeAcknowledgment = {
  version: string;
  accepted_at: string;
};

export function storeScopeAcknowledgment(): ScopeAcknowledgment {
  const row = { version: SCOPE_ACK_VERSION, accepted_at: new Date().toISOString() };
  localStorage.setItem(SCOPE_KEY, JSON.stringify(row));
  sessionStorage.setItem(SCOPE_KEY, JSON.stringify(row));
  return row;
}

export type CookieChoice = "essential" | "all";

export function cookieChoice(): CookieChoice | null {
  const value = localStorage.getItem(COOKIE_KEY);
  return value === "essential" || value === "all" ? value : null;
}

export function storeCookieChoice(choice: CookieChoice) {
  localStorage.setItem(COOKIE_KEY, choice);
}
