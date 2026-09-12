import { useEffect, useRef, useState } from "react";
import { isPaypalConfigured, loadPaypalSdk } from "../lib/paypal";
import { LAUNCH_PROBE_TOKEN, type AccessInterval } from "../lib/pricing";
import { invokeFunction } from "../lib/supabase";

type Props = {
  productSlug: string;
  quantity?: number;
  includeHousehold?: boolean;
  accessInterval?: AccessInterval;
  planKind?: "individual" | "family";
  probe?: boolean;
  onReady?: () => void;
  onCaptured: (result: { productCode: string; productType: string }) => void;
  onError: (message: string) => void;
};

export function PayPalCheckout({
  productSlug,
  quantity = 1,
  includeHousehold = false,
  accessInterval,
  planKind = "individual",
  probe = false,
  onCaptured,
  onError,
  onReady,
}: Props) {
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
        const paypal = await loadPaypalSdk(clientId);
        if (cancelled || !host.current) return;
        host.current.innerHTML = "";
        await paypal.Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
          createOrder: async () => {
            const data = await invokeFunction<{ orderId: string }>("create-paypal-order", {
              productSlug,
              quantity,
              includeHousehold,
              accessInterval,
              plan: planKind,
              ...(probe ? { probe: LAUNCH_PROBE_TOKEN } : {}),
            });
            if (!data?.orderId) throw new Error("No PayPal order was created.");
            return data.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              const captured = await invokeFunction<{ productCode: string; productType: string }>(
                "capture-paypal-order",
                { orderId: data.orderID, productSlug, quantity, includeHousehold, accessInterval, ...(probe ? { probe: LAUNCH_PROBE_TOKEN } : {}) },
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
  }, [productSlug, quantity, includeHousehold, accessInterval, planKind, probe, onReady]);

  return (
    <div>
      {loading && <p className="muted">Loading PayPal…</p>}
      <div className="paypal-box" ref={host} />
    </div>
  );
}
