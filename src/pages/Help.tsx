import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { startOnboardingReplay } from "../components/OnboardingTour";
import { DEFAULT_FAQS, HELP_FAQS_KEY, parseFaqs, withNewDefaults, type HelpFaq } from "../lib/help";
import { openLiveAgentChat } from "../lib/liveAgent";
import { invokeFunction, supabase } from "../lib/supabase";

export function HelpPage() {
  const { profile, user } = useApp();
  const [faqs, setFaqs] = useState<HelpFaq[]>(DEFAULT_FAQS);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [chatting, setChatting] = useState(false);

  useEffect(() => {
    void supabase.from("app_config").select("value").eq("key", HELP_FAQS_KEY).maybeSingle().then(({ data }) => {
      setFaqs(withNewDefaults(parseFaqs(data?.value)));
    });
  }, []);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      setError("Write a short note so we know how to help.");
      return;
    }
    setSending(true);
    setError("");
    setSent("");
    try {
      await invokeFunction("support-ticket", { message: text });
      setMessage("");
      setSent(`Message sent. We’ll reply to ${user?.email || profile?.email || "your account email"} as soon as we can.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function startChat() {
    setError("");
    setChatting(true);
    try {
      await openLiveAgentChat("support", {
        email: profile?.email || user?.email,
        firstName: profile?.first_name,
        lastName: profile?.last_name,
        phone: profile?.phone,
      });
    } catch {
      setError("Chat isn’t available right now. Send a message instead.");
    } finally {
      setChatting(false);
    }
  }

  return (
    <div className="help-page">
      <p className="eyebrow">Help</p>
      <h1 className="page-title">How can we help?</h1>
      <p className="muted help-lead">Replay the tour, browse common questions, or send us a note if you need a person.</p>

      <article className="account-card help-actions">
        <h2>Guided tour</h2>
        <p className="muted">Walk through checking items, notes, family, and your profile again.</p>
        <button className="btn btn-forest" type="button" onClick={() => startOnboardingReplay()}>
          Replay the guided tour
        </button>
      </article>

      <article className="account-card">
        <h2>Frequently asked questions</h2>
        <div className="help-faq-list">
          {faqs.map((faq) => (
            <details key={faq.id} className="help-faq">
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
              {faq.linkTo && faq.linkLabel ? (
                <p>
                  <Link className="btn btn-forest" to={faq.linkTo}>
                    {faq.linkLabel}
                  </Link>
                </p>
              ) : null}
            </details>
          ))}
        </div>
      </article>

      <article className="account-card">
        <h2>Still need help?</h2>
        <p className="muted">Tell us what’s going on with your checklist, account, or devices. We’ll follow up by email.</p>
        <form className="help-form" onSubmit={(event) => void sendMessage(event)}>
          <label className="account-field">
            <span>Your message</span>
            <textarea
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="I need help with…"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {sent ? <p className="account-saved">{sent}</p> : null}
          <div className="help-form-actions">
            <button className="btn btn-forest" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send a message"}
            </button>
            <button className="btn btn-ghost" type="button" disabled={chatting} onClick={() => void startChat()}>
              {chatting ? "Connecting…" : "Chat with us"}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
