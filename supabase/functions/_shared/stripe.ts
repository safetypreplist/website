const API = "https://api.stripe.com/v1";
const API_VERSION = "2026-09-30.endive";

/** One-time license lookup keys (same keys in Test and Live; objects are mode-specific). */
export const PRICE_LOOKUP = {
  basicLifetime: "spl_basic_lifetime",
  basicAdditional: "spl_basic_additional",
  proLifetime: "spl_pro_lifetime",
  upgradeBasicToPro: "spl_upgrade_basic_pro",
} as const;

export type LifetimeProduct = "basic" | "basic_additional" | "pro" | "upgrade_to_pro";

export function lookupForProduct(product: LifetimeProduct) {
  if (product === "basic") return PRICE_LOOKUP.basicLifetime;
  if (product === "basic_additional") return PRICE_LOOKUP.basicAdditional;
  if (product === "pro") return PRICE_LOOKUP.proLifetime;
  return PRICE_LOOKUP.upgradeBasicToPro;
}

export function stripeSecret() {
  const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!key.startsWith("rk_") && !key.startsWith("sk_")) {
    throw new Error("Stripe is not configured on the server.");
  }
  return key;
}

export function isStripeConfigured() {
  const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
  return (key.startsWith("rk_") || key.startsWith("sk_")) && !key.includes("your_");
}

function flatten(value: unknown, key: string, out: URLSearchParams) {
  if (value == null || value === false) return;
  if (value === true) {
    out.append(key, "true");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${key}[${index}]`, out));
    return;
  }
  if (typeof value === "object") {
    for (const [child, nested] of Object.entries(value as Record<string, unknown>)) {
      flatten(nested, `${key}[${child}]`, out);
    }
    return;
  }
  out.append(key, String(value));
}

export function encodeStripeBody(body: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) flatten(value, key, params);
  return params;
}

export async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecret()}`,
    "Stripe-Version": API_VERSION,
  };
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const init: RequestInit = { method, headers };
  if (method === "GET" && body) {
    const query = encodeStripeBody(body).toString();
    const joined = `${url}${url.includes("?") ? "&" : "?"}${query}`;
    const res = await fetch(joined, init);
    return parseStripe(res) as Promise<{ ok: boolean; status: number; body: T }>;
  }
  if (body && method !== "DELETE") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeStripeBody(body);
  }
  const res = await fetch(url, init);
  return parseStripe(res) as Promise<{ ok: boolean; status: number; body: T }>;
}

async function parseStripe(res: Response) {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = body as { error?: { message?: string; type?: string } } | null;
    console.error("Stripe API error", res.status, err?.error?.type, err?.error?.message);
  }
  return { ok: res.ok, status: res.status, body };
}

const LOOKUP_ENV: Record<string, string> = {
  spl_basic_lifetime: "STRIPE_PRICE_BASIC",
  spl_basic_additional: "STRIPE_PRICE_BASIC_ADDITIONAL",
  spl_pro_lifetime: "STRIPE_PRICE_PRO",
  spl_upgrade_basic_pro: "STRIPE_PRICE_UPGRADE",
};

type CatalogPrice = {
  lookup: string;
  product: string;
  productName: string;
  unit_amount: number;
  /** One-time license prices only. */
  type: "one_time";
};

// Software as a service (SaaS) - personal use.
const DIGITAL_TAX_CODE = "txcd_10103000";

const CATALOG: Record<string, CatalogPrice> = {
  spl_basic_lifetime: {
    lookup: "spl_basic_lifetime",
    product: "spl_basic",
    productName: "Safety Prep List — Basic",
    unit_amount: 1299,
    type: "one_time",
  },
  spl_basic_additional: {
    lookup: "spl_basic_additional",
    product: "spl_basic_additional",
    productName: "Safety Prep List — Additional Basic license",
    unit_amount: 999,
    type: "one_time",
  },
  spl_pro_lifetime: {
    lookup: "spl_pro_lifetime",
    product: "spl_pro",
    productName: "Safety Prep List — Pro",
    unit_amount: 2499,
    type: "one_time",
  },
  spl_upgrade_basic_pro: {
    lookup: "spl_upgrade_basic_pro",
    product: "spl_upgrade",
    productName: "Safety Prep List — Upgrade to Pro",
    unit_amount: 1200,
    type: "one_time",
  },
};

async function priceByLookup(lookup: string) {
  const res = await stripeRequest<{ data?: Array<{ id: string }> }>(
    "GET",
    `/prices?active=true&limit=1&lookup_keys[]=${encodeURIComponent(lookup)}`,
  );
  return res.ok ? res.body?.data?.[0]?.id : undefined;
}

async function ensureProduct(id: string, name: string) {
  const existing = await stripeRequest<{ id?: string; tax_code?: string | { id?: string } }>("GET", `/products/${id}`);
  if (existing.ok && existing.body.id) {
    const current = typeof existing.body.tax_code === "string" ? existing.body.tax_code : existing.body.tax_code?.id || "";
    if (current !== DIGITAL_TAX_CODE) {
      const updated = await stripeRequest<{ id?: string }>("POST", `/products/${id}`, {
        name,
        tax_code: DIGITAL_TAX_CODE,
      });
      if (!updated.ok) throw new Error(stripeErrorMessage(updated.body, `Could not set the tax code on ${id}.`));
    }
    return existing.body.id;
  }
  const created = await stripeRequest<{ id?: string }>("POST", "/products", {
    id,
    name,
    tax_code: DIGITAL_TAX_CODE,
  });
  if (created.ok && created.body.id) return created.body.id;
  const retry = await stripeRequest<{ id?: string }>("GET", `/products/${id}`);
  if (retry.ok && retry.body.id) return retry.body.id;
  throw new Error(stripeErrorMessage(created.body, `Could not create Stripe product ${id}.`));
}

async function ensureCatalogPrice(spec: CatalogPrice) {
  await ensureProduct(spec.product, spec.productName);
  const found = await priceByLookup(spec.lookup);
  if (found) {
    const detail = await stripeRequest<{
      id?: string;
      unit_amount?: number;
      type?: string;
      recurring?: { interval?: string } | null;
    }>("GET", `/prices/${found}`);
    const amountOk = detail.ok && detail.body.unit_amount === spec.unit_amount;
    const oneTimeOk = detail.body?.type === "one_time" || !detail.body?.recurring;
    if (amountOk && oneTimeOk) return found;
  }
  // Stripe prices are immutable. Move the lookup key onto a matching one-time price.
  const created = await stripeRequest<{ id?: string }>("POST", "/prices", {
    currency: "usd",
    product: spec.product,
    unit_amount: spec.unit_amount,
    lookup_key: spec.lookup,
    transfer_lookup_key: true,
  });
  if (created.ok && created.body.id) return created.body.id;
  const again = await priceByLookup(spec.lookup);
  if (again) return again;
  throw new Error(stripeErrorMessage(created.body, `Stripe price ${spec.lookup} is not available.`));
}

export async function stripePriceId(lookup: string) {
  const fromEnv = LOOKUP_ENV[lookup] ? Deno.env.get(LOOKUP_ENV[lookup]) : "";
  if (fromEnv?.startsWith("price_")) return fromEnv;
  const spec = CATALOG[lookup];
  if (spec) return ensureCatalogPrice(spec);
  const id = await priceByLookup(lookup);
  if (!id) throw new Error(`Stripe price ${lookup} is not available.`);
  return id;
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  const len = Math.max(a.length, b.length);
  let out = 0;
  for (let i = 0; i < len; i++) out |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return a.length === b.length && out === 0;
}

export async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const digest = hex(signed);
  return signatures.some((sig) => timingSafeEqual(digest, sig));
}

export function stripeErrorMessage(body: unknown, fallback: string) {
  const err = body as { error?: { message?: string } } | null;
  return err?.error?.message || fallback;
}

export function integrationIdentifier() {
  return "safety_prep_list";
}
