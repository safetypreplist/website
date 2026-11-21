import { json, preflight } from "../_shared/http.ts";
import { comingSoonBlock } from "../_shared/comingSoon.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import {
  integrationIdentifier,
  isStripeConfigured,
  lookupForProduct,
  stripeErrorMessage,
  stripePriceId,
  stripeRequest,
  type LifetimeProduct,
} from "../_shared/stripe.ts";
import { serviceClient } from "../_shared/supabase.ts";

function siteUrl(requested: unknown, fallback: string) {
  const base = /^https?:\/\//i.test(fallback) ? fallback.replace(/\/$/, "") : `https://${fallback.replace(/\/$/, "")}`;
  try {
    const origin = new URL(String(requested || "").trim()).origin;
    const host = new URL(origin).hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    if (local || origin === base || origin === "https://safetypreplist.com" || origin === "https://www.safetypreplist.com") {
      return origin;
    }
  } catch {
    /* use configured app URL */
  }
  return base;
}

function parseProduct(raw: unknown): LifetimeProduct | null {
  const value = String(raw || "").trim();
  if (value === "basic" || value === "basic_additional" || value === "pro" || value === "upgrade_to_pro") {
    return value;
  }
  return null;
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!isStripeConfigured()) return json({ error: "Stripe is not configured yet." }, 503);
    const blocked = await comingSoonBlock(req);
    if (blocked) return blocked;
    const limited = await rateLimitBlock(`checkout:${clientIp(req)}`, 12, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const product = parseProduct(body.product);
    if (!product) {
      return json({ error: "Choose Basic, Additional Basic, Pro, or Upgrade to Pro." }, 400);
    }

    const rawAppUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").trim();
    const appUrl = siteUrl(body.origin, rawAppUrl);
    const admin = serviceClient();

    let licenseKey: string | undefined;
    if (product === "upgrade_to_pro") {
      const key = normalizeLicenseKeyLoose(String(body.licenseKey || ""));
      if (!key.startsWith("SPL-")) return json({ error: "Enter your Basic license key to upgrade." }, 400);
      const license = await findLicenseByKey(admin, key);
      if (!license || license.status !== "active" || license.product !== "basic") {
        return json({ error: "That license is not an active Basic license." }, 400);
      }
      licenseKey = license.license_key;
    }

    if (product === "basic_additional") {
      const key = normalizeLicenseKeyLoose(String(body.licenseKey || ""));
      const deviceId = String(body.deviceId || "").trim();
      if (!key.startsWith("SPL-") || !deviceId) {
        return json({ error: "An activated license on this device is required to buy an additional license." }, 400);
      }
      const license = await findLicenseByKey(admin, key);
      if (!license || license.status !== "active") {
        return json({ error: "That license key is not active." }, 400);
      }
      const activeDevice = await admin
        .from("license_devices")
        .select("device_id")
        .eq("license_id", license.id)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (!activeDevice.data) {
        return json({ error: "Additional licenses can only be purchased from a device that already holds this key." }, 403);
      }
      licenseKey = license.license_key;
    }

    const priceId = await stripePriceId(lookupForProduct(product));
    const successUrl = `${appUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripeRequest<{ id: string; url?: string }>("POST", "/checkout/sessions", {
      mode: "payment",
      success_url: successUrl,
      cancel_url: `${appUrl}/#pricing`,
      line_items: [{ price: priceId, quantity: 1 }],
      // Collect email so we can deliver the license key.
      customer_creation: "if_required",
      metadata: {
        product,
        ...(licenseKey ? { license_key: licenseKey } : {}),
      },
      payment_intent_data: {
        metadata: {
          product,
          ...(licenseKey ? { license_key: licenseKey } : {}),
        },
      },
      integration_identifier: integrationIdentifier(),
    });

    if (!session.ok || !session.body.url) {
      return json({ error: stripeErrorMessage(session.body, "Could not start Stripe checkout") }, 502);
    }

    return json({ url: session.body.url, sessionId: session.body.id });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Checkout failed";
    console.error(err);
    return json({ error: message || "Checkout failed" }, 500);
  }
});
