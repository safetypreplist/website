import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PAGE_TITLE, SITE_ORIGIN, SITE_DESCRIPTION } from "../lib/copy";

type Meta = { title: string; description: string; index?: boolean };

const DEFAULT: Meta = { title: PAGE_TITLE, description: SITE_DESCRIPTION, index: true };

const EXACT: Record<string, Meta> = {
  "/": {
    title: "Safety Prep List — Be ready before you need to be.",
    description: SITE_DESCRIPTION,
    index: true,
  },
  "/classic": DEFAULT,
  "/privacy": {
    title: "Privacy Policy — Safety Prep List",
    description: "How Safety Prep List collects, uses, and protects your information.",
  },
  "/terms": {
    title: "Terms of Service — Safety Prep List",
    description: "Terms of Service, including the refund policy, for Safety Prep List.",
  },
  "/contact": {
    title: "Contact — Safety Prep List",
    description: "Questions about Safety Prep List, billing, or your license? Send a message.",
  },
  "/install": {
    title: "Install the App — Safety Prep List",
    description: "Add Safety Prep List to your phone or computer home screen.",
  },
  "/pricing": {
    title: "Plans — Safety Prep List",
    description: SITE_DESCRIPTION,
  },
  "/demo": {
    title: "Sample Checklist — Safety Prep List",
    description: "Try a short sample from the 5-Minute Grab-and-Go Bag. Nothing you check is saved.",
  },
  "/activate": {
    title: "Activate License — Safety Prep List",
    description: "Activate your Safety Prep List license key on this device.",
    index: true,
  },
  "/deactivate": {
    title: "Deactivate & Transfer — Safety Prep List",
    description: "Back up your checklists and confirm license deactivation by email.",
    index: false,
  },
  "/transfer": {
    title: "Transfer Your License — Safety Prep List",
    description: "Move Safety Prep List to a new device after deactivation.",
    index: false,
  },
  "/admin-login": {
    title: "Administrator Login — Safety Prep List",
    description: "Owner console sign-in for Safety Prep List.",
    index: false,
  },
  "/admin": {
    title: "Owner Console — Safety Prep List",
    description: "Operations console for Safety Prep List.",
    index: false,
  },
  "/license": {
    title: "Your License — Safety Prep List",
    description: "Look up your Safety Prep List license, devices, and upgrade options.",
    index: true,
  },
  "/import": {
    title: "Import Shared Checklist — Safety Prep List",
    description: "Open a shared Safety Prep List checklist and save your own copy.",
    index: false,
  },
  "/checkout": {
    title: "Checkout — Safety Prep List",
    description: "Complete your Safety Prep List purchase with Stripe Checkout.",
    index: false,
  },
  "/thank-you": {
    title: "Thank You — Safety Prep List",
    description: "Your Safety Prep List purchase is complete.",
    index: false,
  },
};

const PREFIX: Array<[string, Meta]> = [
  ["/app/lists", { title: "Checklists — Safety Prep List", description: "Your Safety Prep List checklists.", index: false }],
  ["/app/contacts", { title: "Contacts — Safety Prep List", description: "Safety contacts for your household.", index: false }],
  ["/app/safety", { title: "Safety Resources — Safety Prep List", description: "Official emergency-management websites.", index: false }],
  ["/app/help", { title: "Help — Safety Prep List", description: "Help for Safety Prep List.", index: false }],
  ["/app/reset-devices", { title: "Reset Devices — Safety Prep List", description: "Clear activated devices for your license.", index: false }],
  ["/app/transfer", { title: "Transfer My Data — Safety Prep List", description: "Back up or restore personalized checklist data.", index: false }],
  ["/app/survival", { title: "Survival Vault — Safety Prep List", description: "Survival Vault checklists.", index: false }],
  ["/app", { title: "My Checklist — Safety Prep List", description: "Your Safety Prep List dashboard.", index: false }],
];

function metaFor(pathname: string): Meta {
  if (EXACT[pathname]) return EXACT[pathname];
  const match = PREFIX.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] ?? { title: PAGE_TITLE, description: SITE_DESCRIPTION, index: false };
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function PageMeta() {
  const { pathname } = useLocation();
  const meta = metaFor(pathname.replace(/\/+$/, "") || "/");
  const canonicalPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const url = `${SITE_ORIGIN}${canonicalPath}`;
  const image = `${SITE_ORIGIN}/icons/icon-512.png`;

  useEffect(() => {
    document.title = meta.title;
    upsertMeta("name", "description", meta.description);
    upsertMeta("name", "robots", meta.index === false ? "noindex, nofollow" : "index, follow");
    upsertMeta("property", "og:title", meta.title);
    upsertMeta("property", "og:description", meta.description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "Safety Prep List");
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", meta.title);
    upsertMeta("name", "twitter:description", meta.description);
    upsertMeta("name", "twitter:image", image);
    upsertLink("canonical", url);
  }, [meta.description, meta.index, meta.title, image, url]);

  return null;
}
