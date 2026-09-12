import { FormEvent, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function letterFor(name: string) {
  const match = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(match) ? match : "#";
}

export function ContactsPage() {
  const { contacts, addContact, removeContact } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [contacts],
  );

  const groups = useMemo(() => {
    const next: Record<string, typeof sorted> = {};
    for (const contact of sorted) {
      const letter = letterFor(contact.name);
      (next[letter] ||= []).push(contact);
    }
    return next;
  }, [sorted]);

  const groupLetters = useMemo(
    () => Object.keys(groups).sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b))),
    [groups],
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await addContact(name, phone, label);
      setName("");
      setPhone("");
      setLabel("");
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add contact.";
      setError(message.includes("CONTACT_LIMIT") ? "You can save up to 25 household contacts." : message);
    } finally {
      setSaving(false);
    }
  }

  function jumpTo(letter: string) {
    document.getElementById(`contact-letter-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="contacts-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Emergency Contacts</h1>
        </div>
        <button className="btn btn-forest" type="button" onClick={() => setOpen(true)}>
          Add
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-panel">
          <p>No emergency contacts yet.</p>
          <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
            Add a contact
          </button>
        </div>
      ) : (
        <div className="contacts-layout">
          <div className="contacts-list">
            {groupLetters.map((letter) => (
              <section className="list-group" key={letter} id={`contact-letter-${letter}`}>
                <header className="list-group-head letter-head">
                  <h3>{letter}</h3>
                </header>
                <div className="list-group-body">
                  {groups[letter].map((contact) => (
                    <article className="people-row" key={contact.id}>
                      <div>
                        <strong>{contact.name}</strong>
                        {contact.label ? <span className="people-label">{contact.label}</span> : null}
                        <a className="people-phone" href={`tel:${contact.phone.replace(/\s/g, "")}`}>
                          {contact.phone}
                        </a>
                      </div>
                      <button className="row-remove" type="button" onClick={() => void removeContact(contact.id)}>
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <nav className="alpha-index" aria-label="Jump to letter">
            {LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                className={groups[letter] ? "on" : ""}
                disabled={!groups[letter]}
                onClick={() => jumpTo(letter)}
              >
                {letter}
              </button>
            ))}
          </nav>
        </div>
      )}

      {open ? (
        <div className="modal-backdrop" onClick={() => { if (!saving) setOpen(false); }} role="presentation">
          <div
            className="modal-panel sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-contact-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setOpen(false)} disabled={saving}>
              Close
            </button>
            <h2 id="add-contact-title">Add contact</h2>
            <form onSubmit={add}>
              <label className="field">
                <span>Name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus />
              </label>
              <label className="field">
                <span>Phone</span>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" />
              </label>
              <label className="field">
                <span>Relationship or Type</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Neighbor, school, doctor" />
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-forest btn-block" style={{ marginTop: 18 }} type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save contact"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
