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
      "Basic is $12.99 one time (core checklists, one device). Pro is $24.99 one time and includes Survival Vault. Upgrade Basic to Pro for $12.00 from your license page after you activate.",
    linkTo: "/license",
    linkLabel: "Open License",
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
    id: "devices",
    question: "Can I use it on more than one device?",
    answer:
      "One license covers one device. To move it, use Deactivate & transfer with your license key, then activate on the new device. If you've lost the old device, use Reset devices. After you activate, you can add a second device license from your license page.",
    linkTo: "/deactivate",
    linkLabel: "Deactivate & transfer",
  },
  {
    id: "offline",
    question: "How do I use my checklist offline?",
    answer:
      "Turn on Offline access from the guided tour or Home while you’re online. Your checklist then opens on this device even without Wi-Fi or cell service.",
  },
  {
    id: "refund",
    question: "How do I request a refund?",
    answer:
      "First purchases can be refunded within 3 days as long as no checklist has been printed or saved as a PDF. Open Request a refund, explain why, and include your confirmation number.",
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
