export function isPaypalConfigured() {
  const id = import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim();
  return Boolean(id) && !id.includes("your_paypal");
}

export type PaypalSdkMode = "order" | "subscription";

// Order and subscription buttons need differently configured SDK scripts, so each loads under its own namespace.
const NAMESPACE: Record<PaypalSdkMode, string> = {
  order: "paypal",
  subscription: "paypalSubscriptions",
};

export async function loadPaypalSdk(clientId: string, mode: PaypalSdkMode = "order") {
  const namespace = NAMESPACE[mode];
  const globals = window as unknown as Record<string, typeof window.paypal>;
  if (globals[namespace]) return globals[namespace]!;
  if (!clientId) {
    throw new Error("PayPal client ID is not configured.");
  }
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-spl-paypal="${mode}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("PayPal failed to load")));
      return;
    }
    const params =
      mode === "subscription" ? "vault=true&intent=subscription" : "currency=USD&intent=capture";
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&${params}&components=buttons`;
    script.async = true;
    script.dataset.splPaypal = mode;
    script.dataset.namespace = namespace;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal failed to load"));
    document.body.appendChild(script);
  });
  const sdk = globals[namespace];
  if (!sdk) throw new Error("PayPal SDK unavailable");
  return sdk;
}
