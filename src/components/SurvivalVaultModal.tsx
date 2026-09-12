import { useEffect, type MouseEvent } from "react";
import { PHOTO_LIBRARY } from "../lib/photos";
import { SURVIVAL_VAULT_DESCRIPTION } from "../lib/pricing";

const VAULT_PANELS = [
  {
    tag: "Off-Grid Systems",
    title: "Stay capable when the grid is down.",
    copy: "Low tech tools, sanitation, alternative cooking, and manual household systems for days without utilities.",
    subject: "offgrid" as const,
  },
  {
    tag: "Water Purification",
    title: "Store, filter, and treat what you drink.",
    copy: "Storage, filtration, purification, rotation, and emergency collection beyond the bottles in the pantry.",
    subject: "water" as const,
  },
  {
    tag: "Home Battery & Solar",
    title: "Keep essential loads running.",
    copy: "Plan battery capacity, solar input, safe charging, and which devices actually matter overnight.",
    subject: "power" as const,
  },
  {
    tag: "Emergency Cooling / Heat Resilience",
    title: "Stay safe in extreme temperatures.",
    copy: "Blackout cooling, shaded rooms, hydration, and safe warmth when HVAC is not an option.",
    subject: "cooling" as const,
  },
  {
    tag: "Long-Term Food",
    title: "A pantry built for weeks, not a weekend.",
    copy: "Staples, rotation, preservation, and manual food prep for the stretch after the first few days.",
    subject: "food" as const,
  },
  {
    tag: "How-To Videos",
    title: "Watch the skills when you need them.",
    copy: "Practical visual learning for water, power, off grid, food, communications, and home readiness.",
    subject: "video" as const,
  },
];

export function SurvivalVaultModal({
  onClose,
  ctaHref,
  onAdd,
}: {
  price?: string;
  onClose: () => void;
  ctaHref?: string;
  onAdd?: () => void;
}) {
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

  function add(event: MouseEvent) {
    if (!ctaHref) event.preventDefault();
    onAdd?.();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="survival-vault-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <div className="modal-intro">
          <p className="eyebrow">Optional add-on</p>
          <h2 id="survival-vault-title">Survival Vault</h2>
          <p>{SURVIVAL_VAULT_DESCRIPTION}</p>
        </div>
        {VAULT_PANELS.map((panel) => (
          <article className="modal-item" key={panel.tag}>
            <img className="modal-item-media" src={PHOTO_LIBRARY[panel.subject]} alt="" />
            <div>
              <p className="eyebrow">{panel.tag}</p>
              <h3>{panel.title}</h3>
              <p>{panel.copy}</p>
            </div>
          </article>
        ))}
        <div className="modal-cta">
          <a className="btn btn-primary" href={ctaHref || "#pricing"} onClick={add}>
            Add at checkout
          </a>
        </div>
      </div>
    </div>
  );
}
