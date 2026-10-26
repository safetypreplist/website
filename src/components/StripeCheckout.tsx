import { useState } from "react";
import { LEGAL_VERSIONS } from "../lib/legal";
import { storeScopeAcknowledgment } from "../lib/legalConsent";
import { trackBeginCheckout } from "../lib/analytics";
import { PUBLIC_ACCESS, type AccessInterval } from "../lib/pricing";
import { invokeFunction } from "../lib/supabase";

type Props = {
  productSlug: string;
  quantity?: number;
  includeHousehold?: boolean;
  accessInterval?: AccessInterval;
  planKind?: "individual" | "family";
  discountCode?: string;
  from?: string;
  renew?: boolean;
  returnPath?: string;
  beforeRedirect?: () => void;
  onError: (message: string) => void;
};

export function StripeCheckout({
  productSlug,
  quantity = 1,
  includeHousehold = false,
  accessInterval = PUBLIC_ACCESS,
  planKind = "individual",
  discountCode = "",
  from,
  renew = false,
  returnPath,
  beforeRedirect,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const data = await invokeFunction<{ url?: string }>("create-checkout-session", {
        productSlug,
        quantity,
        includeHousehold,
        accessInterval,
        plan: planKind,
        renew,
        discountCode: discountCode || undefined,
        from,
        origin: window.location.origin,
        returnPath,
        acceptedTerms: true,
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
        refundVersion: LEGAL_VERSIONS.refunds,
      });
      if (!data?.url) throw new Error("Checkout did not return a Stripe URL.");
      storeScopeAcknowledgment();
      const itemName =
        productSlug === "spl_vault"
          ? "Survival Vault"
          : planKind === "family"
            ? "Family Plan"
            : "Individual Plan";
      trackBeginCheckout(itemName);
      beforeRedirect?.();
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      onError(err instanceof Error ? err.message : "Could not start Stripe checkout.");
    }
  }

  return (
    <button className="btn btn-primary checkout-stripe" type="button" disabled={busy} onClick={() => void start()}>
      {busy ? "Redirecting to Stripe…" : "Continue to secure checkout"}
    </button>
  );
}
