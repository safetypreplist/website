import { cookieChoice } from "./legalConsent";

const GA_ID = "G-61Z9N8ET9R";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let started = false;

/** Load the Google tag after cookie consent. The first config call records the current page. */
export function enableAnalytics() {
  if (started || cookieChoice() !== "all") return;
  started = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

export function analyticsStarted() {
  return started;
}

export function trackPageView(path: string) {
  if (!started || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
