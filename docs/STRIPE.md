# Stripe — one-time licenses (Live ready)

Checkout accepts **Test** or **Live** keys. Mode is determined solely by which `STRIPE_SECRET_KEY` you set on Supabase Edge Functions (`rk_test_` / `sk_test_` vs `rk_live_` / `sk_live_`). Prefer a [restricted API key (RAK)](https://docs.stripe.com/keys/restricted-api-keys) (`rk_…`) over an unrestricted secret key.

> **Coming Soon / Maintenance Mode:** `create-checkout-session` still calls `comingSoonBlock`. If Maintenance Mode is on in Admin, new visitors cannot buy until you turn it off — even with Live keys.

## Products (lookup keys)

| Lookup key | Amount | Product |
|---|---|---|
| `spl_basic_lifetime` | $12.99 (1299) | Basic — one-time |
| `spl_pro_lifetime` | $24.99 (2499) | Pro — one-time |
| `spl_upgrade_basic_pro` | $12.00 (1200) | Upgrade Basic → Pro — one-time |
| `spl_basic_additional` | $9.99 (999) | Additional Basic license (second device) — one-time |

Checkout uses `mode: "payment"` only. Annual/monthly lookup keys are not used.

Test and Live catalogs are **separate**. Recreate (or let first Live checkout create) the same lookup keys in Live mode. Do not reuse Test `price_…` IDs in Live.

## How price IDs are chosen

1. Optional env overrides: `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_BASIC_ADDITIONAL`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_UPGRADE` (must start with `price_`)
2. Else `stripePriceId` → `ensureCatalogPrice` finds or creates the one-time price by lookup key in the mode of the configured secret

For production, either create the four Live prices in the Dashboard with those lookup keys, or leave overrides unset and let the first Live checkout create matching catalog prices.

## Checkout body

```json
{ "product": "basic" | "basic_additional" | "pro" | "upgrade_to_pro", "licenseKey": "SPL-...." }
```

`licenseKey` is required for `upgrade_to_pro` and must be an active Basic license.

Success URL: `/thank-you?session_id={CHECKOUT_SESSION_ID}`

## Webhook

Handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Creates or upgrades a row in `licenses` and emails the key via Resend. Idempotent on `stripe_session_id`.

Fulfillment must happen in the webhook (not only on the thank-you page). Register a **Live** endpoint separately from Test — same URL is fine; Stripe issues a different signing secret per endpoint.

## Secrets

```
STRIPE_SECRET_KEY=rk_live_...   # Live RAK preferred; use rk_test_... only for Test
STRIPE_WEBHOOK_SECRET=whsec_... # Signing secret for the endpoint in the same mode as the key
ADMIN_SECRET=...                # for admin-licenses (min 16 chars)
RESEND_API_KEY=...
APP_URL=https://safetypreplist.com
```

No Stripe publishable key is required in Vite: Checkout Sessions are created server-side and the browser redirects to `session.url`.

Optional Live price overrides (only if you pin Dashboard price IDs instead of lookup keys):

```
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_BASIC_ADDITIONAL=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_UPGRADE=price_...
```

## Go Live checklist (owner)

Follow Stripe’s [go-live checklist](https://docs.stripe.com/get-started/checklist/go-live). Practical steps for this app:

1. **Stripe Dashboard → Live mode** (toggle off “Test mode”).
2. Confirm the account can accept live payments (business details / payouts as required by Stripe).
3. **Products / Prices (Live):** create one-time USD prices with lookup keys above (or skip and let first checkout create them). Match amounts exactly.
4. **API keys (Live):** Developers → API keys → create a **restricted** Live key with write access for Checkout Sessions, Products, and Prices (and read as needed). Copy `rk_live_…` (or `sk_live_…` only if you must).
5. **Webhook (Live):** Developers → Webhooks → Add endpoint  
   - URL: `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`  
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`  
   - Copy the endpoint signing secret (`whsec_…`).
6. **Supabase secrets** (overwrites previous Test values — keep Test keys only in a separate project/sandbox if you still need Test):

   ```bash
   supabase secrets set STRIPE_SECRET_KEY=rk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

   Clear any Test-only `STRIPE_PRICE_*` overrides, or set them to the matching **Live** `price_…` IDs.
7. **Deploy** the checkout + webhook functions after this code lands:

   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook
   supabase functions deploy checkout-status
   ```

8. **Maintenance Mode:** in Admin, turn Coming Soon / Maintenance Mode **off** before expecting public purchases.
9. **Verify carefully:** a Live checkout charges a real card. Prefer a small real purchase you control (e.g. Additional Basic at $9.99) only when ready; confirm webhook → license row → email → activate. Refund in Dashboard if it was only a smoke test.

## Deploy (functions)

```bash
supabase db push   # or apply licenses migration if not already
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy checkout-status
supabase functions deploy activate-license
supabase functions deploy deactivate-license
supabase functions deploy reset-license
supabase functions deploy admin-licenses
```
