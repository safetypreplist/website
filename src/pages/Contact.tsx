import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { invokeFunction, isSupabaseConfigured } from "../lib/supabase";

const TOPICS = [
  { id: "general", label: "General question" },
  { id: "refund", label: "Refund request" },
  { id: "cancel", label: "Cancel subscription" },
  { id: "privacy", label: "Privacy request" },
  { id: "do-not-sell", label: "Do not sell or share" },
] as const;

type TopicId = (typeof TOPICS)[number]["id"];

function topicFromQuery(value: string | null): TopicId {
  return TOPICS.some((topic) => topic.id === value) ? (value as TopicId) : "general";
}

export function ContactPage() {
  const [params] = useSearchParams();
  const initialTopic = useMemo(() => topicFromQuery(params.get("topic")), [params]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<TopicId>(initialTopic);
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const heading = topic === "refund" ? "Request a refund" : "Contact us";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured()) {
      setError("The contact form is not connected yet.");
      return;
    }
    setSending(true);
    try {
      await invokeFunction("send-contact", { name, email, topic, message, company });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page">
          <p className="eyebrow">Contact</p>
          <h1>{heading}</h1>
          {sent ? (
            <p className="account-saved">Message sent. We will reply to the email you entered.</p>
          ) : (
            <form className="contact-form" onSubmit={(event) => void submit(event)}>
              <label className="account-field">
                <span>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </label>
              <label className="account-field">
                <span>Your email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="account-field">
                <span>What is this about?</span>
                <select value={topic} onChange={(event) => setTopic(event.target.value as TopicId)}>
                  {TOPICS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="account-field">
                <span>Message</span>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  placeholder={topic === "refund" ? "Include your purchase reference if you have it." : "How can we help?"}
                />
              </label>
              <label className="contact-honey" aria-hidden="true">
                Company
                <input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="btn btn-primary" type="submit" disabled={sending}>
                {sending ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
