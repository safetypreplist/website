import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "./Brand";
import { useApp } from "../context/AppContext";
import { onLiveAgentChatChange, openLiveAgentChat, prepareLiveAgent, type ChatTopic } from "../lib/liveAgent";
import { ANNUAL_CENTS, MONTHLY_CENTS, SURVIVAL_VAULT_CENTS } from "../lib/pricing";
import { memberQuickAnswers, visitorQuickAnswers } from "../lib/quickAnswers";

const OPTIONS: Record<ChatTopic, { title: string; detail: string }> = {
  sales: {
    title: "I have a question about Safety Prep List",
    detail: "Plans, pricing, and what’s included",
  },
  support: {
    title: "I need help with my order or account",
    detail: "Billing, access, family seats, or something not working",
  },
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3 0-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.5 9.5h7M8.5 12.5h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SupportChat() {
  const { pathname } = useLocation();
  const { session, profile, user, products, hasSurvivalVault } = useApp();
  const [open, setOpen] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [connecting, setConnecting] = useState<ChatTopic | null>(null);
  const [error, setError] = useState("");
  const [answerId, setAnswerId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const inApp = pathname.startsWith("/app");
  const order: ChatTopic[] = session ? ["support", "sales"] : ["sales", "support"];

  const answers = useMemo(() => {
    const cents = (slug: string, fallback: number) => products.find((p) => p.slug === slug)?.amount_cents ?? fallback;
    const prices = {
      monthlyCents: cents("access_monthly", MONTHLY_CENTS),
      annualCents: cents("access_annual", ANNUAL_CENTS),
      vaultCents: cents("upgrade_full", SURVIVAL_VAULT_CENTS),
    };
    return session ? memberQuickAnswers(prices, hasSurvivalVault) : visitorQuickAnswers(prices);
  }, [products, session, hasSurvivalVault]);
  const activeAnswer = answers.find((answer) => answer.id === answerId) ?? null;

  useEffect(
    () =>
      onLiveAgentChatChange((isOpen) => {
        setChatting(isOpen);
        if (isOpen) setOpen(false);
      }),
    [],
  );

  useEffect(() => {
    if (!open) {
      setAnswerId(null);
      return;
    }
    panelRef.current?.querySelector<HTMLButtonElement>(".support-chat-body button")?.focus();
  }, [open, answerId]);

  useEffect(() => {
    if (!open) return;
    void prepareLiveAgent().catch(() => undefined);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !launcherRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (pathname.startsWith("/admin")) return null;

  async function choose(topic: ChatTopic) {
    setError("");
    setConnecting(topic);
    try {
      await openLiveAgentChat(topic, {
        email: profile?.email || user?.email,
        firstName: profile?.first_name,
        lastName: profile?.last_name,
        phone: profile?.phone,
      });
    } catch {
      setError("Chat isn’t available right now. Send us a message and we’ll reply by email.");
    } finally {
      setConnecting(null);
    }
  }

  if (chatting) return null;

  const chatOption = (topic: ChatTopic) => (
    <button
      key={topic}
      className="support-chat-option"
      type="button"
      disabled={connecting !== null}
      onClick={() => void choose(topic)}
    >
      <span>
        <b>{OPTIONS[topic].title}</b>
        <small>{connecting === topic ? "Connecting you…" : OPTIONS[topic].detail}</small>
      </span>
      <i aria-hidden="true">›</i>
    </button>
  );

  return (
    <div className={`support-chat ${inApp ? "in-app" : ""} ${open ? "open" : ""}`}>
      {open ? (
        <div className="support-chat-panel" ref={panelRef} role="dialog" aria-label="Need help?" id="support-chat-panel">
          <div className="support-chat-head">
            <span className="support-chat-mark">
              <BrandMark className="support-chat-logo" />
            </span>
            <div>
              <b>Safety Prep List</b>
              <small>We’re here to help</small>
            </div>
          </div>
          <div className="support-chat-body">
            {activeAnswer ? (
              <div className="support-chat-answer">
                <button className="support-chat-back" type="button" onClick={() => setAnswerId(null)}>
                  <span aria-hidden="true">‹</span> All questions
                </button>
                <h2>{activeAnswer.question}</h2>
                <p>{activeAnswer.answer}</p>
                {activeAnswer.link ? (
                  <Link className="support-chat-answer-link" to={activeAnswer.link.to} onClick={() => setOpen(false)}>
                    {activeAnswer.link.label} <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
                <p className="support-chat-section">Still have a question?</p>
                <div className="support-chat-options">{chatOption(activeAnswer.topic)}</div>
              </div>
            ) : (
              <>
                <p className="support-chat-greeting">Hello! How can we help you?</p>
                <p className="support-chat-section" id="support-chat-quick-label">
                  Quick answers
                </p>
                <ul className="support-chat-quick" aria-labelledby="support-chat-quick-label">
                  {answers.map((answer) => (
                    <li key={answer.id}>
                      <button type="button" onClick={() => setAnswerId(answer.id)}>
                        <span>{answer.question}</span>
                        <i aria-hidden="true">›</i>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="support-chat-section">Talk to us</p>
                <div className="support-chat-options">{order.map(chatOption)}</div>
              </>
            )}
            {error ? (
              <p className="support-chat-error" role="alert">
                {error}
              </p>
            ) : null}
            <Link className="support-chat-alt" to={session ? "/app/help" : "/contact"} onClick={() => setOpen(false)}>
              Prefer to write? Send us a message
            </Link>
          </div>
        </div>
      ) : null}
      <button
        ref={launcherRef}
        className="support-chat-launcher"
        type="button"
        aria-expanded={open}
        aria-controls="support-chat-panel"
        aria-label={open ? "Close help menu" : "Need help?"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
        <span className="support-chat-label">{open ? "Close" : "Need Help?"}</span>
      </button>
    </div>
  );
}
