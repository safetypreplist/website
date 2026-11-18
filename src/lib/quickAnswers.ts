import { money } from "./format";
import { BASIC_LICENSE_CENTS, PRO_LICENSE_CENTS, UPGRADE_TO_PRO_CENTS } from "./pricing";
import type { ChatTopic } from "./liveAgent";

export type QuickAnswer = {
  id: string;
  question: string;
  answer: string;
  topic: ChatTopic;
  link?: { to: string; label: string };
};

type Prices = { annualCents?: number; vaultCents?: number; basicCents?: number; proCents?: number };

const CHECKLISTS =
  "5-Minute Grab-and-Go Bag, 15-Minute Ready Duffel (72-Hour Continuity Kit), 20-Minute Vehicle OR Suitcase Prep, and 60-Minute Home Resilience";
const VAULT_LISTS =
  "Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, and Long-Term Food";
const REFUND_RULE =
  "First purchases, including the Survival Vault, can be refunded within 3 days as long as no checklist has been printed or saved as a PDF. Renewals aren’t partially refunded.";

export function visitorQuickAnswers(_prices: Prices = {}): QuickAnswer[] {
  return [
    {
      id: "cost",
      question: "How much does it cost?",
      answer: `Basic is ${money(BASIC_LICENSE_CENTS)} one time (core checklists, one device). Pro is ${money(PRO_LICENSE_CENTS)} one time and includes Survival Vault. One license covers one device. Checkout is secure with Stripe.`,
      topic: "sales",
      link: { to: "/#pricing", label: "See plans" },
    },
    {
      id: "devices",
      question: "Can I use it on more than one device?",
      answer: `One license covers one device. After you activate, you can add a second device license from your license page inside the app.`,
      topic: "sales",
      link: { to: "/activate", label: "Activate" },
    },
    {
      id: "included",
      question: "What checklists are included?",
      answer: `Every plan includes the ${CHECKLISTS}. The minutes are a priority session, not a promise that every item is done in that time. Check items off on any device, add notes, add up to 5 of your own items per section, and print any list.`,
      topic: "sales",
    },
    {
      id: "vault",
      question: "What’s in the Survival Vault?",
      answer: `Pro includes ${VAULT_LISTS}. Buy Pro for ${money(PRO_LICENSE_CENTS)}, or upgrade from Basic for ${money(UPGRADE_TO_PRO_CENTS)} on the license page (same key).`,
      topic: "sales",
    },
    {
      id: "offline",
      question: "Does it work without internet?",
      answer:
        "Yes. After you activate, your checklist works offline. Changes save on this device. You can also add the Safety Prep List icon to your phone’s Home Screen; there’s nothing to download from an app store.",
      topic: "sales",
      link: { to: "/install", label: "Add the app icon" },
    },
    {
      id: "sample",
      question: "Can I see a sample first?",
      answer: "Yes. Try a short sample from the 5-Minute Grab-and-Go Bag. Nothing you check is saved.",
      topic: "sales",
      link: { to: "/demo", label: "Try the sample" },
    },
    {
      id: "cancel",
      question: "Can I cancel anytime?",
      answer: `Licenses are one-time purchases — there is no subscription to cancel. ${REFUND_RULE}`,
      topic: "support",
      link: { to: "/refunds", label: "Read the refund policy" },
    },
    {
      id: "activate",
      question: "I can’t activate my license",
      answer: "Open Activate, enter your license key exactly as emailed, and try again. If this device was replaced, use Reset devices with your email and key.",
      topic: "support",
      link: { to: "/app/reset-devices", label: "Reset devices" },
    },
  ];
}

export function memberQuickAnswers(_prices: Prices = {}, hasVault: boolean): QuickAnswer[] {
  const answers: QuickAnswer[] = [
    {
      id: "cost",
      question: "What do I pay each year?",
      answer: `Your license is a one-time purchase. Basic is ${money(BASIC_LICENSE_CENTS)}; Pro is ${money(PRO_LICENSE_CENTS)}. Upgrade Basic to Pro for ${money(UPGRADE_TO_PRO_CENTS)}. Manage your key on the license page.`,
      topic: "support",
      link: { to: "/license", label: "Open License" },
    },
    {
      id: "cancel",
      question: "How do I cancel my plan?",
      answer:
        "Licenses are one-time — there is no subscription to cancel. If you need help with a refund, use the contact form within the refund window.",
      topic: "support",
      link: { to: "/license", label: "Manage license" },
    },
    {
      id: "refund",
      question: "Can I get a refund?",
      answer: `${REFUND_RULE} Open Request a refund, explain why, and include your confirmation number.`,
      topic: "support",
      link: { to: "/contact?topic=refund", label: "Request a refund" },
    },
    {
      id: "family",
      question: "How do I add family members?",
      answer:
        "Open Family in the menu to invite someone new or connect an existing checklist. Each person gets their own Personal Checklist, and you choose View Only or Can Edit.",
      topic: "support",
      link: { to: "/app/lists", label: "Go to Lists" },
    },
    {
      id: "vault",
      question: "How do I get the Survival Vault?",
      answer: `Upgrade to Pro for ${money(UPGRADE_TO_PRO_CENTS)} on the license page (same key). Pro unlocks ${VAULT_LISTS}.`,
      topic: "support",
      link: { to: "/app/lists#survival-vault", label: "Add the Survival Vault" },
    },
    {
      id: "devices",
      question: "Why am I asked about devices?",
      answer:
        "One license covers one device. If you've lost that device, use Reset devices. A second device license is available from your license page after you activate.",
      topic: "support",
      link: { to: "/license", label: "View devices" },
    },
    {
      id: "offline",
      question: "How do I use it without internet?",
      answer:
        "Turn on Offline access on your Home page, or under Your data on your Account page, while you’re connected. Then your checklist opens and saves on this device without Wi-Fi or service, and your changes sync when you reconnect. Purchases and account changes still need a connection.",
      topic: "support",
      link: { to: "/install", label: "Add the app icon" },
    },
    {
      id: "checking",
      question: "How do I check items off or add notes?",
      answer:
        "Open a list and tap the circle next to an item; checked items turn gray. Tap Add note on any item to leave a reminder, like where something is stored.",
      topic: "support",
    },
  ];
  return hasVault ? answers.filter((answer) => answer.id !== "vault") : answers;
}
