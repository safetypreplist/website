import { json, preflight } from "../_shared/http.ts";
import {
  isDiscountUsable,
  loadDiscount,
  normalizeCode,
  planKindFromQuantity,
  quoteWithDiscount,
} from "../_shared/discounts.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body.code || body.discountCode);
    const quantity = Math.max(1, Number(body.quantity || 1) || 1);
    const planKind = planKindFromQuantity(quantity, body.plan);
    const subscriptionCents = Math.max(0, Math.round(Number(body.subscriptionCents || 0) || 0));
    const vaultCents = Math.max(0, Math.round(Number(body.vaultCents || 0) || 0));
    if (!code) return json({ error: "Enter a discount code." }, 400);

    const row = await loadDiscount(code);
    if (!isDiscountUsable(row) || !row) {
      return json({ error: "That code is not active or does not apply to this plan." }, 400);
    }
    const quote = quoteWithDiscount({ row, planKind, subscriptionCents, vaultCents });
    if (!quote.discountCents) {
      return json({ error: "That code is not active or does not apply to this plan." }, 400);
    }
    return json({
      code: row.code,
      discountCents: quote.discountCents,
      dueTodayCents: quote.dueTodayCents,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not check that code." }, 500);
  }
});
