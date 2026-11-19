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
  "First purchases can be refunded within 3 days as long as no checklist has been printed or saved as a PDF.";

export function visitorQuickAnswers(_prices: Prices = {}): QuickAnswer[] {
  return [
    {
      id: "cost",
      question: "How much does it cost?",
      answer: `Basic is ${money(BASIC_LICENSE_CENTS)} one time (core checklists, one device). Pro is ${money(PRO_LICENSE_CENTS)} one time and includes additional preparedness checklists. One license covers one device. Checkout is secure with Stripe.`,
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
      answer: `Basic includes the ${CHECKLISTS}. Pro adds ${VAULT_LISTS}. Check items off on the device you activate, add notes, add up to 5 of your own items per section, and print any list.`,
      topic: "sales",
    },
    {
      id: "pro",
      question: "What’s included with Pro?",
      answer: `Pro includes everything in Basic, plus ${VAULT_LISTS}. Buy Pro for ${money(PRO_LICENSE_CENTS)}, or upgrade from Basic for ${money(UPGRADE_TO_PRO_CENTS)} on the license page (same key).`,
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
      answer:
        "Open Activate and enter your license key exactly as emailed. If it is still active on another device, use Transfer / Deactivate with the same key, then activate on this device.",
      topic: "support",
      link: { to: "/transfer", label: "Transfer / Deactivate" },
    },
  ];
}

export function memberQuickAnswers(_prices: Prices = {}, hasVault: boolean): QuickAnswer[] {
  const answers: QuickAnswer[] = [
    {
      id: "cost",
      question: "What did I pay?",
      answer: `Your license is a one-time purchase. Basic is ${money(BASIC_LICENSE_CENTS)}; Pro is ${money(PRO_LICENSE_CENTS)}. Upgrade Basic to Pro for ${money(UPGRADE_TO_PRO_CENTS)}. Manage your key on the license page.`,
      topic: "support",
      link: { to: "/app/license", label: "Open License" },
    },
    {
      id: "cancel",
      question: "How do I cancel?",
      answer:
        "Licenses are one-time — there is no subscription to cancel. If you need help with a refund, use the contact form within the refund window.",
      topic: "support",
      link: { to: "/app/license", label: "Manage license" },
    },
    {
      id: "refund",
      question: "Can I get a refund?",
      answer: `${REFUND_RULE} Open Request a refund, explain why, and include your confirmation number.`,
      topic: "support",
      link: { to: "/contact?topic=refund", label: "Request a refund" },
    },
    {
      id: "pro",
      question: "How do I upgrade to Pro?",
      answer: `Upgrade to Pro for ${money(UPGRADE_TO_PRO_CENTS)} on the license page (same key). Pro unlocks ${VAULT_LISTS}.`,
      topic: "support",
      link: { to: "/app/license", label: "Open License" },
    },
    {
      id: "devices",
      question: "Why am I asked about devices?",
      answer:
        "One license covers one device. Use Transfer / Deactivate with your license key to back up, free the license, then activate and restore on the new device. A second device license is available from your license page after you activate.",
      topic: "support",
      link: { to: "/app/transfer", label: "Transfer / Deactivate" },
    },
    {
      id: "offline",
      question: "How do I use it without internet?",
      answer:
        "Your checklist is saved on this device, so it opens and updates without Wi-Fi or service. Purchases and transfers still need a connection.",
      topic: "support",
      link: { to: "/install", label: "Add the app icon" },
    },
    {
      id: "recover-key",
      question: "I lost my license key. How do I get it back?",
      answer:
        "Open Recover My License and enter the email from your purchase. We’ll send a secure link to view your key. If it’s still active on another device, deactivate first, then activate on this one.",
      topic: "support",
      link: { to: "/license-recovery", label: "Recover My License" },
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
