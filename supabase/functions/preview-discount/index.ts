import { json, preflight } from "../_shared/http.ts";
import { parseAccessInterval } from "../_shared/billing.ts";
import {
  isDiscountUsable,
  loadDiscount,
  normalizeCode,
  planKindFromQuantity,
  quoteWithDiscount,
} from "../_shared/discounts.ts";
import { productBySlug } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body.code || body.discountCode);
    const quantity = Math.max(1, Number(body.quantity || 1) || 1);
    const planKind = planKindFromQuantity(quantity, body.plan);
    if (!code) return json({ error: "Enter a discount code." }, 400);

    let access = parseAccessInterval(body.accessInterval);
    if (!access) {
      // Older clients send only subscriptionCents; infer the interval from it.
      const annual = await productBySlug("access_annual");
      access = annual && Number(body.subscriptionCents) === annual.amount_cents * quantity ? "annual" : "monthly";
    }

    const accessProduct = await productBySlug(access === "annual" ? "access_annual" : "access_monthly");
    if (!accessProduct) return json({ error: "Subscription pricing unavailable" }, 400);
    const subscriptionCents = accessProduct.amount_cents * quantity;
    let vaultCents = 0;
    if (body.includeHousehold || Number(body.vaultCents) > 0) {
      vaultCents = (await productBySlug("upgrade_full"))?.amount_cents || 0;
    }

    const row = await loadDiscount(code);
    if (!isDiscountUsable(row) || !row) {
      return json({ error: "That code is not active or does not apply to this plan." }, 400);
    }
    const quote = quoteWithDiscount({ row, planKind, subscriptionCents, vaultCents, quantity, interval: access });
    if (!quote.discountCents) {
      const billing = row.applies_to_interval;
      if (billing === "monthly" || billing === "annual") {
        return json({ error: `That code only works with ${billing === "monthly" ? "Monthly" : "Annual"} billing.` }, 400);
      }
      return json({ error: "That code is not active or does not apply to this plan." }, 400);
    }
    return json({
      code: row.code,
      kind: row.kind,
      discountCents: quote.discountCents,
      dueTodayCents: quote.dueTodayCents,
      regularCents: subscriptionCents,
      discountPayments: Math.max(1, row.discount_payments || 1),
      appliesToInterval: row.applies_to_interval || "all",
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not check that code." }, 500);
  }
});
