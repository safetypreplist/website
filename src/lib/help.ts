export type HelpFaq = {
  id: string;
  question: string;
  answer: string;
};

export const HELP_FAQS_KEY = "help_faqs";

export const DEFAULT_FAQS: HelpFaq[] = [
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
    answer: "Go to Manage Family Plan to invite someone new or connect an existing checklist so you can prepare together.",
  },
  {
    id: "devices",
    question: "Why am I asked about devices?",
    answer: "Each login can stay active on a limited number of devices. Remove an old one from My Devices if you need a free slot.",
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
      const item = row as { id?: unknown; question?: unknown; answer?: unknown };
      const question = typeof item.question === "string" ? item.question.trim() : "";
      const answer = typeof item.answer === "string" ? item.answer.trim() : "";
      if (!question || !answer) return null;
      return {
        id: typeof item.id === "string" && item.id ? item.id : `faq-${index}`,
        question,
        answer,
      };
    })
    .filter((row): row is HelpFaq => Boolean(row));
}
