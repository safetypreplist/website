import { Link } from "react-router-dom";
import { getLicense } from "../lib/licenseClient";
import { invokeFunction } from "../lib/supabase";
import { useState } from "react";

/** Basic licenses see this on Survival Vault routes — upgrade to Pro, same key. */
export function SurvivalVaultPurchase() {
  const license = getLicense();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upgrade() {
    if (!license?.key) {
      window.location.assign("/license");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await invokeFunction<{ url?: string }>("create-checkout-session", {
        product: "upgrade_to_pro",
        licenseKey: license.key,
        origin: window.location.origin,
      });
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not start upgrade.");
    }
  }

  return (
    <div className="vault-purchase">
      <p className="vault-purchase-price">
        <b>Pro</b> unlocks Survival Vault checklists. Upgrade keeps your same license key.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-primary vault-purchase-open" type="button" disabled={busy} onClick={() => void upgrade()}>
        {busy ? "Redirecting…" : "Upgrade to Pro — $12.00"}
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        Or manage your key on the <Link to="/license">license page</Link>.
      </p>
    </div>
  );
}
