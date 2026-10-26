import { money } from "./format";
import { FAMILY_MIN_SEATS } from "./pricing";
import type { ChatTopic } from "./liveAgent";

export type QuickAnswer = {
  id: string;
  question: string;
  answer: string;
  topic: ChatTopic;
  link?: { to: string; label: string };
};

type Prices = { annualCents: number; vaultCents: number };

const CHECKLISTS =
  "5-Minute Grab-and-Go Bag, 15-Minute Ready Duffel (72-Hour Continuity Kit), 20-Minute Vehicle OR Suitcase Prep, and 60-Minute Home Resilience";
const VAULT_LISTS =
  "Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, and Long-Term Food";
const REFUND_RULE =
  "First purchases, including the Survival Vault, can be refunded within 3 days as long as no checklist has been printed or saved as a PDF. Renewals aren’t partially refunded.";

export function visitorQuickAnswers({ annualCents, vaultCents }: Prices): QuickAnswer[] {
  return [
    {
      id: "cost",
      question: "How much does it cost?",
      answer: `${money(annualCents)} per Personal Checklist per year. One yearly payment — there is no monthly plan. Family plans are ${money(annualCents)} per person per year. Survival Vault is an optional add-on for ${money(vaultCents)}/year (not per person). Checkout is secure with Stripe.`,
      topic: "sales",
      link: { to: "/#pricing", label: "See plans" },
    },
    {
      id: "family",
      question: "How does the Family Plan work?",
      answer: `${FAMILY_MIN_SEATS} or more people, each with their own Personal Checklist, connected under one plan. The owner chooses View Only or Can Edit for each checklist. It’s ${money(annualCents)} a year per member, so ${FAMILY_MIN_SEATS} members is ${money(annualCents * FAMILY_MIN_SEATS)} a year.`,
      topic: "sales",
      link: { to: "/#pricing", label: "See the Family Plan" },
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
      answer: `For an extra ${money(vaultCents)}/year you unlock ${VAULT_LISTS}. Add it at checkout.`,
      topic: "sales",
    },
    {
      id: "offline",
      question: "Does it work without internet?",
      answer:
        "Yes. Turn on Offline access when you sign in, and your checklist keeps working when Wi-Fi or service is down. Your changes sync when you reconnect. You can also add the Safety Prep List icon to your phone’s Home Screen; there’s nothing to download from an app store.",
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
      answer: `Yes. Cancel in Account Settings before your next yearly renewal, and you keep access through the end of the year you paid for. ${REFUND_RULE}`,
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

export function memberQuickAnswers({ annualCents, vaultCents }: Prices, hasVault: boolean): QuickAnswer[] {
  const answers: QuickAnswer[] = [
    {
      id: "cost",
      question: "What do I pay each year?",
      answer: `Plans renew once a year. Each Personal Checklist is ${money(annualCents)}/year. Survival Vault is an optional ${money(vaultCents)}/year add-on (not per person). There is no monthly plan for new purchases. See Billing for your exact renewal amount.`,
      topic: "support",
      link: { to: "/app/billing", label: "Open Billing" },
    },
    {
      id: "cancel",
      question: "How do I cancel my plan?",
      answer:
        "Go to Account and choose Cancel subscription. You won’t be charged again, and you keep access through the end of the yearly period you already paid for.",
      topic: "support",
      link: { to: "/app/account", label: "Go to Account" },
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
      link: { to: "/app/family", label: "Go to Connected Checklists" },
    },
    {
      id: "vault",
      question: "How do I get the Survival Vault?",
      answer: `Add it at the end of your basic checklists or at checkout. For an extra ${money(vaultCents)}/year it unlocks ${VAULT_LISTS}.`,
      topic: "support",
      link: { to: "/app/lists#survival-vault", label: "Add the Survival Vault" },
    },
    {
      id: "devices",
      question: "Why am I asked about devices?",
      answer:
        "Each login can be used on 2 devices, like a phone and a computer. To use a new one, remove a device you no longer use in My Devices. Your other devices stay signed in.",
      topic: "support",
      link: { to: "/app/devices", label: "Go to My Devices" },
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
