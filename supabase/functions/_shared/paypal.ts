export const PAYPAL_ENV = Deno.env.get("PAYPAL_ENV") === "live" ? "live" : "sandbox";
const BASE =
  PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function accessToken() {
  const sandbox = PAYPAL_ENV === "sandbox";
  const id = (sandbox && Deno.env.get("PAYPAL_SANDBOX_CLIENT_ID")) || Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = (sandbox && Deno.env.get("PAYPAL_SANDBOX_CLIENT_SECRET")) || Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) {
    throw new Error("PayPal credentials are not configured on the server.");
  }
  const auth = btoa(`${id}:${secret}`);
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed (${res.status})`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function paypalFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

export function dollarsFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export { generateProductCode } from "./productCode.ts";
