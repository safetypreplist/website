import { cookieChoice } from "./legalConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __splGaGranted?: boolean;
    _uxa?: unknown[];
    CS_CONF?: unknown;
  }
}

let started = false;

/** Turn analytics cookies on after Accept. The tag itself is already in the page head. */
export function enableAnalytics() {
  if (started || cookieChoice() !== "all") return;
  started = true;
  window.gtag?.("consent", "update", { analytics_storage: "granted" });
  if (window.__splGaGranted) return;
  window.__splGaGranted = true;
  trackPageView(`${window.location.pathname}${window.location.search}`);
}

export function analyticsStarted() {
  return started;
}

export function trackPageView(path: string) {
  if (!window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackBeginCheckout(itemName: string) {
  if (cookieChoice() !== "all" || !window.gtag) return;
  window.gtag("event", "begin_checkout", {
    currency: "USD",
    items: [{ item_name: itemName }],
  });
}

export function trackPurchase(input: { transactionId: string; valueCents: number; itemName: string }) {
  if (cookieChoice() !== "all" || !window.gtag || !input.transactionId) return;
  const key = "spl.ga.purchase";
  if (sessionStorage.getItem(key) === input.transactionId) return;
  sessionStorage.setItem(key, input.transactionId);
  window.gtag("event", "purchase", {
    transaction_id: input.transactionId,
    value: Math.round(input.valueCents) / 100,
    currency: "USD",
    items: [{ item_name: input.itemName }],
  });
}

export function optOutContentsquare() {
  window._uxa = window._uxa || [];
  window._uxa.push(["optout"]);
}

export function trackContentsquarePage() {
  if (cookieChoice() === "essential" || typeof window.CS_CONF === "undefined") return;
  const path = window.location.pathname + window.location.hash.replace("#", "?__");
  window._uxa = window._uxa || [];
  window._uxa.push(["trackPageview", path]);
}
