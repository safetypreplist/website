import { useId, useState } from "react";
import { useApp } from "../context/AppContext";
import { LegalAgreement } from "./LegalAgreement";
import { StripeCheckout } from "./StripeCheckout";

export function SurvivalVaultPurchase() {
  const { profile } = useApp();
  const agreeId = useId();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const entitled = profile?.plan === "core" || profile?.plan === "full";

  if (!entitled) {
    return <p className="muted">Purchase a plan first, then add Survival Vault for $10 one time.</p>;
  }

  if (!open) {
    return (
      <button className="btn btn-primary vault-purchase-open" type="button" onClick={() => setOpen(true)}>
        Add Survival Vault for $10
      </button>
    );
  }

  return (
    <div className="vault-purchase">
      <p className="vault-purchase-price">
        <b>$10</b> one time. Not per person. Does not renew.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <LegalAgreement id={agreeId} checked={agreed} onChange={setAgreed} />
      {agreed ? (
        <StripeCheckout productSlug="upgrade_full" onError={setError} />
      ) : (
        <p className="muted">Agree to the policies above to continue to checkout.</p>
      )}
    </div>
  );
}
