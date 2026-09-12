import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { SAFETY_CATEGORY_LABELS, US_STATES } from "../lib/format";
import type { SafetyContact } from "../types";

type Pane = "state" | "national";

export function SafetyPage() {
  const { safety, profile, setPreferredState } = useApp();
  const [state, setState] = useState(profile?.preferred_state || "");
  const [pane, setPane] = useState<Pane>("national");

  useEffect(() => {
    if (profile?.preferred_state) setState(profile.preferred_state);
  }, [profile?.preferred_state]);

  const national = useMemo(() => safety.filter((s) => !s.state), [safety]);
  const local = useMemo(() => safety.filter((s) => s.state === state), [safety, state]);
  const stateName = US_STATES.find((row) => row[0] === state)?.[1];

  async function persistState(next: string) {
    setState(next);
    if (next) setPane("state");
    await setPreferredState(next);
  }

  return (
    <div className="safety-page">
      <h1 className="page-title">Safety Resources</h1>
      <p className="muted safety-lead">
        National emergency numbers are always available. Choose your state for additional local resources.
      </p>
      <p className="muted safety-lead">Tap a number to call.</p>

      <label className="state-picker">
        <span>Select your state</span>
        <span className="state-picker-control">
          <select value={state} onChange={(e) => void persistState(e.target.value)}>
            <option value="">Choose a state</option>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div className="safety-tabs" role="tablist" aria-label="Number lists">
        <button
          type="button"
          role="tab"
          aria-selected={pane === "national"}
          className={pane === "national" ? "on" : ""}
          onClick={() => setPane("national")}
        >
          National
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "state"}
          className={pane === "state" ? "on" : ""}
          onClick={() => setPane("state")}
        >
          {stateName || "Choose State"}
        </button>
      </div>

      {pane === "state" ? (
        state ? (
          <section className="list-group safety-fresh" key={state}>
            <header className="list-group-head">
              <h3>{stateName}</h3>
            </header>
            <div className="list-group-body">
              {local.length ? (
                local.map((row) => <SafetyRow row={row} key={row.id} />)
              ) : (
                <p className="empty-row">No verified {stateName} numbers yet. Use National for 911, 988, and poison control.</p>
              )}
            </div>
          </section>
        ) : (
          <p className="empty-panel">Choose your state to see local emergency resources.</p>
        )
      ) : (
        <section className="list-group">
          <header className="list-group-head">
            <h3>National</h3>
          </header>
          <div className="list-group-body">
            {national.map((row) => (
              <SafetyRow row={row} key={row.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SafetyRow({ row }: { row: SafetyContact }) {
  const category = SAFETY_CATEGORY_LABELS[row.category] || row.category;
  const tel = row.phone?.replace(/\s/g, "") ?? "";

  return (
    <article className="people-row safety-row">
      <div>
        <span className="people-label">{category}</span>
        <strong>{row.agency_name}</strong>
        {row.phone ? (
          <a className="people-phone" href={`tel:${tel}`}>
            {row.phone}
          </a>
        ) : row.website ? (
          <a className="people-phone" href={row.website} target="_blank" rel="noreferrer">
            {row.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
        {row.notes ? <span className="safety-note">{row.notes}</span> : null}
      </div>
    </article>
  );
}
