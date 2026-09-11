export function isPaypalConfigured() {
  const id = import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim();
  return Boolean(id) && !id.includes("your_paypal");
}

export async function loadPaypalSdk(clientId: string) {
  if (window.paypal) return window.paypal;
  if (!clientId) {
    throw new Error("PayPal client ID is not configured.");
  }
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector("script[data-spl-paypal]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("PayPal failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    script.async = true;
    script.dataset.splPaypal = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal failed to load"));
    document.body.appendChild(script);
  });
  if (!window.paypal) throw new Error("PayPal SDK unavailable");
  return window.paypal;
}
