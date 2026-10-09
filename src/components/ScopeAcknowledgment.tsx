import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function ScopeAcknowledgment({
  checked,
  onChange,
  id = "scope-ack",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <label className="legal-agree" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>
          I have read, understand, and agree to the{" "}
          <button
            className="scope-ack-open"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
          >
            Safety Prep List Scope &amp; Use Acknowledgment
          </button>
          .
        </span>
      </label>
      {open ? (
        <ScopeAcknowledgmentModal
          onClose={() => setOpen(false)}
          onAgree={() => {
            onChange(true);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function ScopeAcknowledgmentModal({ onClose, onAgree }: { onClose: () => void; onAgree: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel scope-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-ack-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <p className="eyebrow">Please read before purchase</p>
        <h2 id="scope-ack-title">Scope &amp; Use Acknowledgment</h2>

        <h3>What Safety Prep List is</h3>
        <ul>
          <li>
            A general preparedness resource for <strong>natural disasters, local emergencies, outages, evacuations, and
            temporary disruptions.</strong>
          </li>
          <li>
            Practical information for when a household may need to leave home, shelter temporarily, experience an outage,
            or manage a short-term disruption.
          </li>
        </ul>

        <h3>What it is not</h3>
        <ul>
          <li>
            <strong>Not an all-inclusive emergency, tactical, weapons, bunker, or security guide.</strong> It does not
            provide instructions for weapons, combat, explosives, bomb-making, or specialized security operations, and it
            does not cover every possible emergency or threat.
          </li>
          <li>
            Not a replacement for emergency services, official instructions, local emergency-management guidance,
            professional medical advice, utility guidance, building requirements, or other qualified professional advice.
          </li>
        </ul>

        <h3>Your responsibility</h3>
        <ul>
          <li>
            <strong>
              Always follow evacuation orders, emergency alerts, public-health instructions, and other directions from the
              appropriate authorities.
            </strong>
          </li>
          <li>
            Preparedness needs vary by household, location, climate, medical needs, abilities, laws, and circumstances. You
            are responsible for determining what information, supplies, equipment, and preparations are appropriate for
            your situation.
          </li>
        </ul>

        <p className="scope-modal-links">
          See also the{" "}
          <Link to="/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="scope-modal-actions">
          <button className="btn btn-primary" type="button" onClick={onAgree}>
            I understand and agree
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
