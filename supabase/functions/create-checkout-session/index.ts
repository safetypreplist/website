import { json, preflight } from "../_shared/http.ts";
import { comingSoonBlock } from "../_shared/comingSoon.ts";
import { parseAccessInterval } from "../_shared/billing.ts";
import {
  discountAlreadyUsedBy,
  isDiscountUsable,
  launchOfferAllowed,
  loadDiscount,
  normalizeCode,
  planKindFromQuantity,
  quoteWithDiscount,
} from "../_shared/discounts.ts";
import { parseQuantity } from "../_shared/quantity.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import {
  integrationIdentifier,
  isStripeConfigured,
  PRICE_LOOKUP,
  stripeErrorMessage,
  stripePriceId,
  stripeRequest,
} from "../_shared/stripe.ts";
import { productBySlug, requireUser, serviceClient } from "../_shared/supabase.ts";

async function recordTerms(req: Request, userId: string | null, body: Record<string, unknown>) {
  try {
    await serviceClient().from("terms_acceptances").insert({
      user_id: userId,
      email: null,
      terms_version: String(body.termsVersion || ""),
      privacy_version: String(body.privacyVersion || ""),
      refund_version: String(body.refundVersion || ""),
      ip_address: (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent"),
      context: "checkout",
    });
  } catch (err) {
    console.error("Could not record checkout agreement", err);
  }
}

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

async function customerForUser(user: { id: string; email?: string } | null) {
  if (!user) return { customer: undefined as string | undefined, customer_email: undefined as string | undefined };
  const admin = serviceClient();
  const { data } = await admin.from("profiles").select("stripe_customer_id,email").eq("id", user.id).maybeSingle();
  const existing = (data as { stripe_customer_id?: string | null; email?: string | null } | null)?.stripe_customer_id;
  if (existing) return { customer: existing, customer_email: undefined };
  const email = user.email || (data as { email?: string | null } | null)?.email || undefined;
  if (!email) return { customer: undefined, customer_email: undefined };
  const created = await stripeRequest<{ id: string }>("POST", "/customers", {
    email,
    metadata: { supabase_user_id: user.id },
  });
  if (!created.ok || !created.body.id) return { customer: undefined, customer_email: email };
  await admin.from("profiles").update({ stripe_customer_id: created.body.id }).eq("id", user.id);
  return { customer: created.body.id, customer_email: undefined };
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
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!body.acceptedTerms) {
      return json({ error: "Please agree to the Terms of Service, Privacy Policy, and Refund Policy." }, 400);
    }

    const slug = String(body.productSlug || "core");
    const { user } = await requireUser(req);
    const admin = serviceClient();
    const rawAppUrl = (Deno.env.get("APP_URL") || "https://safetypreplist.com").trim();
    const appUrl = siteUrl(body.origin, rawAppUrl);
    const { customer, customer_email } = await customerForUser(user ? { id: user.id, email: user.email } : null);

    if (slug === "upgrade_full") {
      if (!user) return json({ error: "Sign in required" }, 401);
      const vault = await productBySlug("upgrade_full");
      if (!vault) return json({ error: "Survival Vault unavailable" }, 400);
      const vaultPrice = await stripePriceId(PRICE_LOOKUP.vault);
      const thankYou = new URL("/thank-you", appUrl);
      thankYou.searchParams.set("vault", "1");
      const session = await stripeRequest<{ id: string; url?: string }>("POST", "/checkout/sessions", {
        mode: "payment",
        client_reference_id: user.id,
        ...(customer ? { customer } : customer_email ? { customer_email } : {}),
        success_url: `${thankYou.toString()}${thankYou.search ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`.replace(
          "&&",
          "&",
        ),
        cancel_url: `${appUrl}/#pricing`,
        line_items: [{ price: vaultPrice, quantity: 1 }],
        metadata: { product: "upgrade_full", user_id: user.id },
        payment_intent_data: { metadata: { product: "upgrade_full", user_id: user.id } },
        integration_identifier: integrationIdentifier(),
      });
      if (!session.ok || !session.body.url) {
        return json({ error: stripeErrorMessage(session.body, "Could not start Stripe checkout") }, 502);
      }
      await recordTerms(req, user.id, body);
      return json({ url: session.body.url, sessionId: session.body.id });
    }

    // New checkouts are annual-only. Legacy monthly renewals may still pass monthly.
    const requestedAccess = parseAccessInterval(body.accessInterval) || "annual";
    const access = requestedAccess === "monthly" && Boolean(body.renew) ? "monthly" : "annual";
    const renew = Boolean(body.renew);
    if (renew && !user) return json({ error: "Sign in to renew your plan." }, 401);

    let purpose: "new" | "add_member" | "renew" = "new";
    const parsedQty = parseQuantity(body.quantity ?? 1);
    if (parsedQty == null) return json({ error: "Choose between 1 and 20 checklists." }, 400);
    let quantity = parsedQty;
    let includeVault = Boolean(body.includeHousehold);

    if (renew && user) {
      purpose = "renew";
      includeVault = false;
      const lapsed = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["cancelled", "expired", "suspended"]);
      const lapsedIds = ((lapsed.data || []) as Array<{ id: string }>).map((row) => row.id);
      if (!lapsedIds.length) return json({ error: "There is no ended plan to renew." }, 400);
      const { count } = await admin
        .from("personal_checklists")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .in("subscription_id", lapsedIds);
      quantity = Math.min(20, Math.max(1, count || 1));
    } else if (user) {
      const { data: own } = await admin
        .from("personal_checklists")
        .select("id")
        .eq("owner_user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (own) purpose = "add_member";
    }

    const accessProduct = await productBySlug(access === "annual" ? "access_annual" : "access_monthly");
    if (!accessProduct) return json({ error: "Subscription pricing unavailable" }, 400);
    const subscriptionCents = accessProduct.amount_cents * quantity;

    let vaultCents = 0;
    if (includeVault) {
      const vault = await productBySlug("upgrade_full");
      if (!vault) return json({ error: "Survival Vault unavailable" }, 400);
      vaultCents = vault.amount_cents;
    }

    const planKind = planKindFromQuantity(quantity, body.plan);
    const requestedCode = normalizeCode(body.discountCode);
    let discountCode = "";
    let discountCents = 0;
    let discountPayments = 0;
    if (requestedCode) {
      if (purpose !== "new") {
        return json({ error: "That code is not active or does not apply to this plan." }, 400);
      }
      const row = await loadDiscount(requestedCode);
      const quote = quoteWithDiscount({ row, planKind, subscriptionCents, vaultCents, quantity, interval: access });
      const reused = await discountAlreadyUsedBy(requestedCode, user?.id, user?.email);
      if (!isDiscountUsable(row) || !row || !quote.discountCents || reused || !launchOfferAllowed(requestedCode, body.from)) {
        return json({ error: "That code is not active or does not apply to this plan." }, 400);
      }
      discountCode = row.code;
      discountCents = quote.discountCents;
      discountPayments = Math.max(1, row.discount_payments || 1);
    }

    const firstPaymentCents = vaultCents + (discountCents > 0 ? subscriptionCents - discountCents : subscriptionCents);
    const recurringPrice = await stripePriceId(access === "annual" ? PRICE_LOOKUP.annual : PRICE_LOOKUP.monthly);
    const lineItems: Array<Record<string, unknown>> = [{ price: recurringPrice, quantity }];
    if (includeVault) {
      lineItems.push({ price: await stripePriceId(PRICE_LOOKUP.vault), quantity: 1 });
    }

    const pending = await admin
      .from("subscriptions")
      .insert({
        provider: "stripe",
        paypal_subscription_id: null,
        paypal_plan_id: null,
        stripe_price_id: recurringPrice,
        user_id: user?.id ?? null,
        purpose,
        access_interval: access,
        quantity,
        regular_cents: subscriptionCents,
        first_payment_cents: firstPaymentCents,
        vault_cents: vaultCents,
        discount_code: discountCode || null,
        discount_cents: discountCents,
        discount_payments: discountCents > 0 ? discountPayments : null,
        status: "approval_pending",
      })
      .select("id")
      .single();
    if (pending.error || !pending.data) {
      console.error(pending.error);
      return json({ error: "Could not start Stripe checkout" }, 500);
    }
    const localId = (pending.data as { id: string }).id;

    const requestedReturn = String(body.returnPath || "");
    const safeReturn = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "";
    const thankYou = new URL(safeReturn || "/thank-you", appUrl);
    if (!safeReturn) {
      thankYou.searchParams.set("plan", quantity > 1 ? "family" : "individual");
      thankYou.searchParams.set("qty", String(quantity));
      thankYou.searchParams.set("vault", includeVault ? "1" : "0");
      thankYou.searchParams.set("access", access);
      if (purpose === "add_member") thankYou.searchParams.set("add", "1");
    }
    thankYou.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    // Stripe replaces the literal {CHECKOUT_SESSION_ID} in success_url.
    const successUrl = `${thankYou.origin}${thankYou.pathname}?${thankYou.searchParams
      .toString()
      .replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}")}`;

    const discounts: Array<Record<string, string>> = [];
    if (discountCents > 0) {
      const coupon = await stripeRequest<{ id: string }>("POST", "/coupons", {
        amount_off: discountCents,
        currency: "usd",
        duration: discountPayments > 1 ? "repeating" : "once",
        ...(discountPayments > 1 ? { duration_in_months: discountPayments } : {}),
        max_redemptions: 1,
        name: discountCode || "Discount",
        metadata: { code: discountCode, subscription_id: localId },
      });
      if (!coupon.ok || !coupon.body.id) {
        await admin.from("subscriptions").delete().eq("id", localId);
        return json({ error: stripeErrorMessage(coupon.body, "Could not apply that discount.") }, 502);
      }
      discounts.push({ coupon: coupon.body.id });
    }

    const session = await stripeRequest<{ id: string; url?: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      client_reference_id: user?.id || localId,
      ...(customer ? { customer } : customer_email ? { customer_email } : {}),
      success_url: successUrl,
      cancel_url: `${appUrl}/#pricing`,
      line_items: lineItems,
      ...(discounts.length ? { discounts } : {}),
      metadata: {
        subscription_id: localId,
        purpose,
        quantity: String(quantity),
        access,
        discount_code: discountCode,
        from: String(body.from || ""),
        user_id: user?.id || "",
        include_vault: includeVault ? "1" : "0",
      },
      subscription_data: {
        metadata: {
          subscription_id: localId,
          purpose,
          user_id: user?.id || "",
        },
      },
      integration_identifier: integrationIdentifier(),
    });

    if (!session.ok || !session.body.url) {
      await admin.from("subscriptions").delete().eq("id", localId);
      return json({ error: stripeErrorMessage(session.body, "Could not start Stripe checkout") }, 502);
    }

    await admin
      .from("subscriptions")
      .update({ stripe_checkout_session_id: session.body.id, stripe_customer_id: customer || null })
      .eq("id", localId);
    await recordTerms(req, user?.id ?? null, body);
    return json({ url: session.body.url, sessionId: session.body.id, quantity, firstPaymentCents });
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
