import { useEffect, type MouseEvent } from "react";
import { VAULT_CHECKLISTS } from "../lib/copy";
import { PHOTO_LIBRARY, type PhotoSubject } from "../lib/photos";
import { SURVIVAL_VAULT_DESCRIPTION } from "../lib/pricing";

const VAULT_SUBJECTS: Record<(typeof VAULT_CHECKLISTS)[number]["title"], PhotoSubject> = {
  "Off-Grid Systems": "offgrid",
  "Water Purification": "water",
  "Home Battery & Solar": "power",
  "Emergency Cooling / Heat Resilience": "cooling",
  "Long-Term Food": "food",
  "How-To Videos": "video",
};

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
        {VAULT_CHECKLISTS.map((panel) => (
          <article className="modal-item" key={panel.title}>
            <img className="modal-item-media" src={PHOTO_LIBRARY[VAULT_SUBJECTS[panel.title]]} alt="" />
            <div>
              <p className="eyebrow">{panel.title}</p>
              <h3>{panel.line}</h3>
              <p>{panel.detail}</p>
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
