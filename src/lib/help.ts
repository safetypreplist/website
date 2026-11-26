import { isRetiredAccountCopy } from "./copy";
import { supportFaqsForHelp, type SupportFaq } from "./supportFaqs";

export type HelpFaq = {
  id: string;
  question: string;
  answer: string;
  linkTo?: string;
  linkLabel?: string;
};

export const HELP_FAQS_KEY = "help_faqs";

function toHelpFaq(faq: SupportFaq): HelpFaq {
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    ...(faq.linkTo && faq.linkLabel ? { linkTo: faq.linkTo, linkLabel: faq.linkLabel } : {}),
  };
}

/** Built-in Help FAQs — kept in sync with live support via supportFaqs.ts. */
export const DEFAULT_FAQS: HelpFaq[] = supportFaqsForHelp().map(toHelpFaq);

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

/**
 * Built-in FAQ ids always use the latest product copy from DEFAULT_FAQS.
 * Custom admin-added FAQs (unknown ids) are kept after the built-ins.
 */
export function withNewDefaults(saved: HelpFaq[]): HelpFaq[] {
  if (!saved.length) return DEFAULT_FAQS;
  const defaultIds = new Set(DEFAULT_FAQS.map((item) => item.id));
  const defaultQuestions = new Set(DEFAULT_FAQS.map((item) => item.question.trim().toLowerCase()));
  const custom = saved.filter(
    (item) =>
      !defaultIds.has(item.id) &&
      !defaultQuestions.has(item.question.trim().toLowerCase()) &&
      !isRetiredAccountCopy(item.question, item.answer),
  );
  return [...DEFAULT_FAQS, ...custom];
}
