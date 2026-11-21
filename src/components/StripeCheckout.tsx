import { useState } from "react";
import { LEGAL_VERSIONS } from "../lib/legal";
import { storeScopeAcknowledgment } from "../lib/legalConsent";
import { trackBeginCheckout } from "../lib/analytics";
import { invokeFunction } from "../lib/supabase";

export type CheckoutProduct = "basic" | "pro" | "upgrade_to_pro" | "group_sharing";

type Props = {
  /** Lifetime product for create-checkout-session (Phase 1+). */
  product?: CheckoutProduct;
  licenseKey?: string;
  from?: string;
  returnPath?: string;
  beforeRedirect?: () => void;
  onError: (message: string) => void;
  /** @deprecated Prefer `product`. Mapped for leftover Purchase page wiring. */
  productSlug?: string;
  includeHousehold?: boolean;
};

function resolveProduct(props: Pick<Props, "product" | "productSlug" | "includeHousehold">): CheckoutProduct {
  if (props.product) return props.product;
  if (props.includeHousehold) return "pro";
  if (props.productSlug === "spl_vault" || props.productSlug === "pro") return "pro";
  return "basic";
}

export function StripeCheckout({
  product: productProp,
  licenseKey,
  from,
  returnPath,
  beforeRedirect,
  onError,
  productSlug,
  includeHousehold = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const product = resolveProduct({ product: productProp, productSlug, includeHousehold });

  async function start() {
    setBusy(true);
    try {
      const data = await invokeFunction<{ url?: string }>("create-checkout-session", {
        product,
        ...(licenseKey ? { licenseKey } : {}),
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
        product === "pro"
          ? "Pro lifetime"
          : product === "upgrade_to_pro"
            ? "Upgrade to Pro"
            : product === "group_sharing"
              ? "Group Sharing"
              : "Basic lifetime";
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
