import { cookieChoice } from "./legalConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __splGaGranted?: boolean;
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
