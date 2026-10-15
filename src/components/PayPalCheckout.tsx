import { useEffect, useRef, useState } from "react";
import { LEGAL_VERSIONS } from "../lib/legal";
import { isPaypalConfigured, loadPaypalSdk } from "../lib/paypal";
import { MAX_CHECKLIST_QUANTITY, type AccessInterval } from "../lib/pricing";
import { invokeFunction } from "../lib/supabase";

type Props = {
  productSlug: string;
  quantity?: number;
  includeHousehold?: boolean;
  accessInterval?: AccessInterval;
  planKind?: "individual" | "family";
  discountCode?: string;
  renew?: boolean;
  onReady?: () => void;
  onCaptured: (result: { productCode: string; productType: string; linkedToUser?: boolean }) => void;
  onError: (message: string) => void;
};

export function PayPalCheckout({
  productSlug,
  quantity = 1,
  includeHousehold = false,
  accessInterval,
  planKind = "individual",
  discountCode = "",
  renew = false,
  onCaptured,
  onError,
  onReady,
}: Props) {
  const qty = Math.min(MAX_CHECKLIST_QUANTITY, Math.max(1, Math.floor(quantity) || 1));
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const capturedRef = useRef(onCaptured);
  const errorRef = useRef(onError);
  capturedRef.current = onCaptured;
  errorRef.current = onError;

  useEffect(() => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
    let cancelled = false;

    async function mount() {
      try {
        if (!isPaypalConfigured()) {
          setLoading(false);
          errorRef.current("PayPal is not configured yet. Add VITE_PAYPAL_CLIENT_ID and deploy the Edge Functions.");
          return;
        }
        const subscription = productSlug === "core";
        const paypal = await loadPaypalSdk(clientId, subscription ? "subscription" : "order");
        if (cancelled || !host.current) return;
        host.current.innerHTML = "";
        const style = { layout: "vertical", color: "gold", shape: "pill", label: subscription ? "subscribe" : "paypal" };
        if (subscription) {
          await paypal.Buttons({
            style,
            createSubscription: async () => {
              const data = await invokeFunction<{ subscriptionId: string }>("create-paypal-subscription", {
                quantity: qty,
                includeHousehold,
                accessInterval,
                plan: planKind,
                renew,
                discountCode: discountCode || undefined,
                acceptedTerms: true,
                termsVersion: LEGAL_VERSIONS.terms,
                privacyVersion: LEGAL_VERSIONS.privacy,
                refundVersion: LEGAL_VERSIONS.refunds,
              });
              if (!data?.subscriptionId) throw new Error("No PayPal subscription was created.");
              return data.subscriptionId;
            },
            onApprove: async (data: { subscriptionID: string }) => {
              try {
                const activated = await invokeFunction<{ productCode: string; productType: string; linkedToUser?: boolean }>(
                  "activate-paypal-subscription",
                  { subscriptionId: data.subscriptionID },
                );
                if (!activated?.productCode) {
                  throw new Error("Your subscription started, but no Product ID came back. Contact us and we’ll link it.");
                }
                capturedRef.current(activated);
              } catch (err) {
                errorRef.current(err instanceof Error ? err.message : "Could not finish the purchase.");
              }
            },
            onError: (err: unknown) => {
              console.error(err);
              errorRef.current("PayPal checkout was interrupted. Try again.");
            },
          }).render(host.current);
          onReady?.();
          return;
        }
        await paypal.Buttons({
          style,
          createOrder: async () => {
            const data = await invokeFunction<{ orderId: string }>("create-paypal-order", {
              productSlug,
              quantity: qty,
              includeHousehold,
              accessInterval,
              plan: planKind,
              discountCode: discountCode || undefined,
              acceptedTerms: true,
              termsVersion: LEGAL_VERSIONS.terms,
              privacyVersion: LEGAL_VERSIONS.privacy,
              refundVersion: LEGAL_VERSIONS.refunds,
            });
            if (!data?.orderId) throw new Error("No PayPal order was created.");
            return data.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              const captured = await invokeFunction<{ productCode: string; productType: string }>(
                "capture-paypal-order",
                { orderId: data.orderID, productSlug, quantity: qty, includeHousehold, accessInterval, discountCode: discountCode || undefined },
              );
              if (!captured?.productCode) {
                throw new Error("Payment went through, but no Product ID came back. Stay on the thank-you page if it opens.");
              }
              capturedRef.current(captured);
            } catch (err) {
              errorRef.current(err instanceof Error ? err.message : "Could not finish the purchase.");
            }
          },
          onError: (err: unknown) => {
            console.error(err);
            errorRef.current("PayPal checkout was interrupted. Try again.");
          },
        }).render(host.current);
        onReady?.();
      } catch (err) {
        console.error(err);
        errorRef.current(err instanceof Error ? err.message : "PayPal failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void mount();
    return () => {
      cancelled = true;
    };
  }, [productSlug, qty, includeHousehold, accessInterval, planKind, discountCode, renew, onReady]);

  return (
    <div>
      {loading && <p className="muted">Loading PayPal…</p>}
      <div className="paypal-box" ref={host} />
    </div>
  );
}
