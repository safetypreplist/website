import { FormEvent, useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { startOnboardingReplay } from "../components/OnboardingTour";
import { DEFAULT_FAQS, HELP_FAQS_KEY, parseFaqs, type HelpFaq } from "../lib/help";
import { supabase } from "../lib/supabase";

declare global {
  interface Window {
    Tawk_API?: { maximize?: () => void };
  }
}

export function HelpPage() {
  const { profile, user } = useApp();
  const [faqs, setFaqs] = useState<HelpFaq[]>(DEFAULT_FAQS);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "info@safetypreplist.com";

  useEffect(() => {
    void supabase.from("app_config").select("value").eq("key", HELP_FAQS_KEY).maybeSingle().then(({ data }) => {
      const next = parseFaqs(data?.value);
      if (next.length) setFaqs(next);
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
    const email = user?.email || profile?.email || "";
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.display_name || "";
    const { error: saveError } = await supabase.from("help_requests").insert({
      user_id: user?.id ?? null,
      email: email || null,
      name: name || null,
      message: text,
    });
    setSending(false);
    if (saveError) {
      window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent("Help with my Safety Prep List")}&body=${encodeURIComponent(text)}`;
      return;
    }
    setMessage("");
    setSent("Message sent. We’ll get back to you as soon as we can.");
  }

  function openChat() {
    if (window.Tawk_API?.maximize) {
      window.Tawk_API.maximize();
      return;
    }
    window.location.href = `mailto:${supportEmail}`;
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
            <button className="btn btn-ghost" type="button" onClick={openChat}>
              Chat with us
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
