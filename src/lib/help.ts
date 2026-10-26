export type HelpFaq = {
  id: string;
  question: string;
  answer: string;
  linkTo?: string;
  linkLabel?: string;
};

export const HELP_FAQS_KEY = "help_faqs";

export const DEFAULT_FAQS: HelpFaq[] = [
  {
    id: "pricing",
    question: "What does my plan cost?",
    answer:
      "Safety Prep List is billed once a year: $30 per Personal Checklist. There is no monthly plan for new purchases. Survival Vault is an optional $10/year add-on (not per person). Open Billing to see your renewal date and amount.",
    linkTo: "/app/billing",
    linkLabel: "Open Billing",
  },
  {
    id: "check",
    question: "How do I check items off?",
    answer: "Open a list and tap the circle next to an item. Checked items turn gray and italic so you can see what is already done.",
  },
  {
    id: "notes",
    question: "How do I add a note?",
    answer: "On any item, tap Add note to leave a reminder for yourself — for example, where something is stored or what size to buy.",
  },
  {
    id: "family",
    question: "How do I add family members?",
    answer: "Open Connected Checklists in the menu to invite someone new or connect an existing checklist so you can prepare together.",
  },
  {
    id: "offline",
    question: "How do I use my checklist offline?",
    answer:
      "Open your Account page (tap your profile photo at the top, or Account in the menu). Scroll down to Your data and turn on Offline access. Your checklist will then open on this device even without Wi-Fi or cell service. Turn it on for each phone, tablet, or computer you use.",
  },
  {
    id: "devices",
    question: "Why am I asked about devices?",
    answer: "Each login can stay active on a limited number of devices. Remove an old one from My Devices if you need a free slot.",
  },
  {
    id: "refund",
    question: "How do I request a refund?",
    answer:
      "First purchases, including the Survival Vault, can be refunded within 3 days as long as no checklist has been printed or saved as a PDF. Renewals aren’t partially refunded. Open Request a refund, explain why, and include your confirmation number.",
    linkTo: "/contact?topic=refund",
    linkLabel: "Request a refund",
  },
  {
    id: "tour",
    question: "Can I see the guided tour again?",
    answer: "Yes. Use Replay the guided tour on this Help page anytime you want a walkthrough of the app.",
  },
];

export function parseFaqs(value: unknown): HelpFaq[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const item = row as { id?: unknown; question?: unknown; answer?: unknown; linkTo?: unknown; linkLabel?: unknown };
      const question = typeof item.question === "string" ? item.question.trim() : "";
      const answer = typeof item.answer === "string" ? item.answer.trim() : "";
      if (!question || !answer) return null;
      const linkTo = typeof item.linkTo === "string" && item.linkTo.startsWith("/") ? item.linkTo : undefined;
      const linkLabel = typeof item.linkLabel === "string" ? item.linkLabel.trim() : "";
      return {
        id: typeof item.id === "string" && item.id ? item.id : `faq-${index}`,
        question,
        answer,
        ...(linkTo && linkLabel ? { linkTo, linkLabel } : {}),
      };
    })
    .filter((row): row is HelpFaq => Boolean(row));
}

/** Saved FAQs plus any built-in question added after the list was last saved. */
export function withNewDefaults(saved: HelpFaq[]): HelpFaq[] {
  if (!saved.length) return DEFAULT_FAQS;
  const ids = new Set(saved.map((item) => item.id));
  const merged = [...saved];
  DEFAULT_FAQS.forEach((item, index) => {
    if (ids.has(item.id)) return;
    const before = DEFAULT_FAQS.slice(0, index).reverse().find((prev) => ids.has(prev.id));
    const at = before ? merged.findIndex((row) => row.id === before.id) + 1 : 0;
    merged.splice(at, 0, item);
    ids.add(item.id);
  });
  return merged.map((item) => {
    if (item.linkTo) return item;
    const fallback = DEFAULT_FAQS.find((row) => row.id === item.id);
    if (!fallback?.linkTo || !fallback.linkLabel) return item;
    return { ...item, linkTo: fallback.linkTo, linkLabel: fallback.linkLabel };
  });
}
