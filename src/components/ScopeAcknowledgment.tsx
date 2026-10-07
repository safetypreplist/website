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
  return (
    <section className="scope-ack" aria-labelledby="scope-ack-title">
      <h2 id="scope-ack-title">Safety Prep List — Scope & Use Acknowledgment</h2>
      <p>
        <strong>Please read before completing your purchase.</strong>
      </p>
      <p>
        Safety Prep List is a general preparedness resource designed to help households prepare for{" "}
        <strong>natural disasters, local emergencies, outages, evacuations, and temporary disruptions.</strong>
      </p>
      <p>
        It is intended to provide practical preparedness information for situations where a household may need to leave
        home, shelter temporarily, experience an outage, or manage a short-term disruption.
      </p>
      <p>
        <strong>
          Safety Prep List is not an all-inclusive emergency, tactical, weapons, bunker, or security guide. It does not
          provide instructions for weapons, combat, explosives, bomb-making, or specialized security operations, and it
          does not cover every possible emergency or threat.
        </strong>
      </p>
      <p>
        Safety Prep List does not replace emergency services, official instructions, local emergency-management
        guidance, professional medical advice, utility guidance, building requirements, or other qualified professional
        advice.
      </p>
      <p>
        <strong>
          Always follow evacuation orders, emergency alerts, public-health instructions, and other directions from the
          appropriate authorities.
        </strong>
      </p>
      <p>
        Preparedness needs vary by household, location, climate, medical needs, abilities, laws, and circumstances. You
        are responsible for determining what information, supplies, equipment, and preparations are appropriate for your
        situation.
      </p>
      <p>By checking the box below, I confirm that I have read and understand the scope and intended use of Safety Prep List.</p>
      <p className="scope-ack-links">
        <Link to="/terms" target="_blank" rel="noreferrer">
          Terms of Service
        </Link>
        {" · "}
        <Link to="/privacy" target="_blank" rel="noreferrer">
          Privacy Policy
        </Link>
      </p>
      <label className="legal-agree" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>I understand and agree to the Safety Prep List scope and use described above.</span>
      </label>
    </section>
  );
}
