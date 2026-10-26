import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PAGE_TITLE, SITE_ORIGIN, SITE_DESCRIPTION } from "../lib/copy";

type Meta = { title: string; description: string; index?: boolean };

const DEFAULT: Meta = { title: PAGE_TITLE, description: SITE_DESCRIPTION, index: true };

const EXACT: Record<string, Meta> = {
  "/": {
    title: "Safety Prep List — Be ready before you need to be.",
    description:
      "$30 per Personal Checklist per year. No monthly subscription. Optional Survival Vault is $10/year.",
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
    description: "Questions about Safety Prep List, billing, or your account? Send a message.",
  },
  "/install": {
    title: "Install the App — Safety Prep List",
    description: "Add Safety Prep List to your phone or computer home screen.",
  },
  "/pricing": {
    title: "Plans — Safety Prep List",
    description: "$30 per Personal Checklist per year. No monthly subscription. Family Plans and optional Survival Vault $10/year add-on.",
  },
  "/demo": {
    title: "Sample Checklist — Safety Prep List",
    description: "Try a short sample from the 5-Minute Grab-and-Go Bag. Nothing you check is saved.",
  },
  "/signin": {
    title: "Sign In — Safety Prep List",
    description: "Sign in to your Safety Prep List checklists.",
    index: false,
  },
  "/create-account": {
    title: "Create Account — Safety Prep List",
    description: "Create your Safety Prep List account after checkout.",
    index: false,
  },
  "/join": {
    title: "Join Family Plan — Safety Prep List",
    description: "Accept your family’s invitation to a paid Safety Prep List checklist.",
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
  "/reset-password": {
    title: "Reset Password — Safety Prep List",
    description: "Reset the password for your Safety Prep List account.",
    index: false,
  },
  "/update-password": {
    title: "Update Password — Safety Prep List",
    description: "Choose a new password for your Safety Prep List account.",
    index: false,
  },
};

const PREFIX: Array<[string, Meta]> = [
  ["/app/lists", { title: "Checklists — Safety Prep List", description: "Your Safety Prep List checklists.", index: false }],
  ["/app/contacts", { title: "Contacts — Safety Prep List", description: "Safety contacts for your household.", index: false }],
  ["/app/safety", { title: "Safety Resources — Safety Prep List", description: "Official emergency-management websites.", index: false }],
  ["/app/account", { title: "Account — Safety Prep List", description: "Your Safety Prep List account.", index: false }],
  ["/app/billing/receipt", { title: "Receipt — Safety Prep List", description: "A Safety Prep List payment receipt.", index: false }],
  ["/app/billing", { title: "Billing — Safety Prep List", description: "Your Safety Prep List billing history.", index: false }],
  ["/app/renew", { title: "Renew — Safety Prep List", description: "Renew your Safety Prep List plan.", index: false }],
  ["/app/help", { title: "Help — Safety Prep List", description: "Help for Safety Prep List.", index: false }],
  ["/app/devices", { title: "Devices — Safety Prep List", description: "Devices signed in to your Safety Prep List account.", index: false }],
  ["/app/family", { title: "Family Plan — Safety Prep List", description: "Manage your Safety Prep List Family Plan.", index: false }],
  ["/app/survival", { title: "Survival Vault — Safety Prep List", description: "Survival Vault checklists.", index: false }],
  ["/app/access", { title: "Checklist Access — Safety Prep List", description: "Who can view or edit family checklists.", index: false }],
  ["/admin", { title: "Owner — Safety Prep List", description: "Safety Prep List owner tools.", index: false }],
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
