import { useState } from "react";
import { Link } from "react-router-dom";
import { ItemTip } from "../components/ItemTip";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { SAMPLE_CHECKLIST } from "../lib/sampleChecklist";

const NOTE_LIMIT = 100;

/** A public sample. Checkmarks and notes live only in this page's memory and never reach an account. */
export function DemoPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [openNoteTip, setOpenNoteTip] = useState<string | null>(null);
  const [openTip, setOpenTip] = useState<string | null>(null);
  const items = SAMPLE_CHECKLIST.sections.flatMap((section) => section.items);
  const done = items.filter((item) => checked[item.id]).length;
  const percent = Math.round((done / items.length) * 100);

  function saveNote(itemId: string) {
    setNotes((current) => ({ ...current, [itemId]: draft.trim() }));
    setOpenNote(null);
  }

  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page demo-page">
          <p className="eyebrow">Sample checklist</p>
          <h1>Try a sample checklist</h1>
          <p className="demo-lead">
            This is a short sample from the {SAMPLE_CHECKLIST.title}. Tap an item to check it off, or add a note. This
            sample is not saved: your checkmarks and notes disappear when you leave this page.
          </p>

          <div className="demo-list">
            <header className="demo-list-head">
              <div>
                <h2>{SAMPLE_CHECKLIST.title}</h2>
                <p className="muted">{SAMPLE_CHECKLIST.description}</p>
              </div>
              <div className="demo-progress" aria-label={`${done} of ${items.length} items checked`}>
                <b>{percent}%</b>
                <span>
                  {done} of {items.length} checked
                </span>
              </div>
            </header>

            {SAMPLE_CHECKLIST.sections.map((section) => (
              <section className="list-group" key={section.id}>
                <header className="list-group-head">
                  <div className="list-group-title">
                    <h3>{section.title}</h3>
                  </div>
                </header>
                <p className="demo-section-intro">{section.intro}</p>
                <div className="list-group-body">
                  {section.items.map((item) => {
                    const on = Boolean(checked[item.id]);
                    const note = notes[item.id] || "";
                    const noteOpen = openNote === item.id;
                    const tipOpen = openTip === item.id;
                    const noteTipOpen = openNoteTip === item.id;
                    const toggle = () => setChecked((current) => ({ ...current, [item.id]: !current[item.id] }));
                    return (
                      <article className={`check-item${on ? " is-done" : ""}${note ? " has-note" : ""}`} key={item.id}>
                        <div className="check-row">
                          <button
                            className={`check ${on ? "on" : ""}`}
                            aria-pressed={on}
                            aria-label={item.text}
                            type="button"
                            onClick={toggle}
                          >
                            {on ? "✓" : ""}
                          </button>
                          <div className="check-main">
                            <button className="check-copy" type="button" onClick={toggle}>
                              <span className="check-title">{item.text}</span>
                            </button>
                          </div>
                          <ItemTip
                            open={tipOpen}
                            text={item.description}
                            onToggle={() => {
                              setOpenNoteTip(null);
                              setOpenTip((current) => (current === item.id ? null : item.id));
                            }}
                          />
                          <div className={`note-tip-wrap${noteTipOpen ? " open" : ""}`}>
                            <button
                              className={`note-toggle${note ? " has-note" : " add-note"}`}
                              type="button"
                              aria-expanded={noteOpen || noteTipOpen}
                              onClick={() => {
                                setOpenTip(null);
                                if (note && !noteOpen) {
                                  setOpenNote(null);
                                  setOpenNoteTip((current) => (current === item.id ? null : item.id));
                                  return;
                                }
                                if (noteOpen) {
                                  saveNote(item.id);
                                  return;
                                }
                                setOpenNoteTip(null);
                                setDraft(note);
                                setOpenNote(item.id);
                              }}
                            >
                              {note ? "View note" : "Add note"}
                            </button>
                            {noteTipOpen && note ? (
                              <div className="item-pop note" role="group" aria-label="Note">
                                <span className="item-pop-kicker">Note</span>
                                {note}
                                <button
                                  className="note-edit"
                                  type="button"
                                  onClick={() => {
                                    setOpenNoteTip(null);
                                    setDraft(note);
                                    setOpenNote(item.id);
                                  }}
                                >
                                  Edit note
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {noteOpen ? (
                          <div className="note-box">
                            <input
                              maxLength={NOTE_LIMIT}
                              placeholder="Add a short note"
                              aria-label={`Note for ${item.text}`}
                              value={draft}
                              autoFocus
                              enterKeyHint="done"
                              onChange={(event) => setDraft(event.target.value)}
                              onBlur={() => saveNote(item.id)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                saveNote(item.id);
                              }}
                            />
                            <p className="note-hint">
                              <span className="note-hint-enter">Press Enter to save</span>
                              <span className="note-hint-done">Press Done to save</span>
                            </p>
                            <p className="note-sensitivity">This is a sample. Notes disappear when you leave this page.</p>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <section className="demo-full">
            <h2>The full Safety Prep List</h2>
            <p>With a plan, you get the complete checklists, saved to your account:</p>
            <ul>
              <li>5-Minute Grab-and-Go Bag</li>
              <li>15-Minute Ready Duffel (72-Hour Continuity Kit)</li>
              <li>20-Minute Vehicle OR Suitcase Prep</li>
              <li>60-Minute Home Resilience</li>
            </ul>
            <p>
              Add your own items, keep notes, share with family, print a paper backup, and prepare your checklists for
              offline use on your phone, tablet, or computer. Plans are $30 per Personal Checklist per year — no monthly
              option. Survival Vault is an optional $10/year add-on.
            </p>
            <div className="demo-actions">
              <a className="btn btn-primary" href="/#pricing">
                Choose a Plan
              </a>
              <Link className="btn btn-ghost" to="/signin">
                Already a customer? Sign in
              </Link>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
