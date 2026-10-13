import { money } from "./format";
import { annualSavingsPercent } from "./copy";
import { FAMILY_MIN_SEATS } from "./pricing";
import type { ChatTopic } from "./liveAgent";

export type QuickAnswer = {
  id: string;
  question: string;
  answer: string;
  topic: ChatTopic;
  link?: { to: string; label: string };
};

type Prices = { monthlyCents: number; annualCents: number; vaultCents: number };

const CHECKLISTS =
  "5-Minute Grab-and-Go Bag, 15-Minute Ready Duffel (72-Hour Continuity Kit), 20-Minute Vehicle OR Suitcase Prep, and 60-Minute Home Resilience";
const VAULT_LISTS =
  "Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, Long-Term Food, and How-To Videos (a curated YouTube playlist)";
const REFUND_RULE =
  "First purchases, including the Survival Vault, can be refunded within 3 days as long as no checklist has been printed or saved as a PDF. Renewals aren’t partially refunded.";

export function visitorQuickAnswers({ monthlyCents, annualCents, vaultCents }: Prices): QuickAnswer[] {
  const savePct = annualSavingsPercent(monthlyCents, annualCents);
  return [
    {
      id: "cost",
      question: "How much does it cost?",
      answer: `${money(monthlyCents)} a month or ${money(annualCents)} a year for each Personal Checklist${
        savePct ? `. Annual billing saves ${savePct}%` : ""
      }. You check out securely with PayPal, PayPal Credit, or a debit or credit card.`,
      topic: "sales",
      link: { to: "/pricing", label: "See plans" },
    },
    {
      id: "family",
      question: "How does the Family Plan work?",
      answer: `${FAMILY_MIN_SEATS} or more people, each with their own Personal Checklist, connected under one plan. The owner chooses View Only or Can Edit for each checklist. It’s ${money(monthlyCents)} a month or ${money(annualCents)} a year per member, so ${FAMILY_MIN_SEATS} members is ${money(monthlyCents * FAMILY_MIN_SEATS)} a month.`,
      topic: "sales",
      link: { to: "/pricing", label: "See the Family Plan" },
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
      answer: `${VAULT_LISTS}. It’s ${money(vaultCents)} one time, not per person, and it doesn’t renew. Add it at checkout.`,
      topic: "sales",
    },
    {
      id: "cancel",
      question: "Can I cancel anytime?",
      answer: `Yes. Cancel in Account Settings before your next billing date, and you keep access through the end of the period you paid for. ${REFUND_RULE}`,
      topic: "support",
      link: { to: "/refunds", label: "Read the refund policy" },
    },
    {
      id: "signin",
      question: "I can’t sign in",
      answer: "Choose Forgot password on the sign-in page and we’ll email you a link to set a new one.",
      topic: "support",
      link: { to: "/reset-password", label: "Reset my password" },
    },
  ];
}

export function memberQuickAnswers({ vaultCents }: Prices, hasVault: boolean): QuickAnswer[] {
  const answers: QuickAnswer[] = [
    {
      id: "cancel",
      question: "How do I cancel my plan?",
      answer:
        "Go to Account and choose Cancel subscription. You won’t be charged again, and you keep access through the end of the period you already paid for.",
      topic: "support",
      link: { to: "/app/account", label: "Go to Account" },
    },
    {
      id: "refund",
      question: "Can I get a refund?",
      answer: `${REFUND_RULE} Send us a message and a team member will review it.`,
      topic: "support",
      link: { to: "/app/help", label: "Send us a message" },
    },
    {
      id: "family",
      question: "How do I add family members?",
      answer:
        "Open Family in the menu to invite someone new or connect an existing checklist. Each person gets their own Personal Checklist, and you choose View Only or Can Edit.",
      topic: "support",
      link: { to: "/app/family", label: "Go to Family" },
    },
    {
      id: "vault",
      question: "How do I get the Survival Vault?",
      answer: `Add it from your Account page. It unlocks ${VAULT_LISTS}. It’s ${money(vaultCents)} one time, not per person, and it doesn’t renew.`,
      topic: "support",
      link: { to: "/app/account#addons", label: "Add the Survival Vault" },
    },
    {
      id: "devices",
      question: "Why am I asked about devices?",
      answer:
        "Each login can stay active on a limited number of devices. Remove an old one from My Devices if you need a free slot.",
      topic: "support",
      link: { to: "/app/devices", label: "Go to My Devices" },
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
