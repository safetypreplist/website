import type { ChatTopic } from "./liveAgent";
import { supportFaqsForChat } from "./supportFaqs";

export type QuickAnswer = {
  id: string;
  question: string;
  answer: string;
  topic: ChatTopic;
  link?: { to: string; label: string };
};

type Prices = { annualCents?: number; vaultCents?: number; basicCents?: number; proCents?: number };

function toQuickAnswers(kind: "visitor" | "member"): QuickAnswer[] {
  return supportFaqsForChat(kind).map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    topic: faq.topic,
    ...(faq.linkTo && faq.linkLabel ? { link: { to: faq.linkTo, label: faq.linkLabel } } : {}),
  }));
}

/** Public-site chat answers. Prices argument kept for call-site compatibility. */
export function visitorQuickAnswers(_prices: Prices = {}): QuickAnswer[] {
  return toQuickAnswers("visitor");
}

/** In-app chat answers for licensed customers. */
export function memberQuickAnswers(_prices: Prices = {}, _hasVault = false): QuickAnswer[] {
  return toQuickAnswers("member");
}
