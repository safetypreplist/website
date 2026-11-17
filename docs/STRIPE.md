# Stripe — one-time licenses (Phase 1)

**Phase 1 is Test Mode only.** Do not create or archive Live prices until Phase 1 review passes.

## Products (lookup keys)

| Lookup key | Amount | Product |
|---|---|---|
| `spl_basic_lifetime` | $12.99 (1299) | Basic — one-time |
| `spl_pro_lifetime` | $24.99 (2499) | Pro — one-time |
| `spl_upgrade_basic_pro` | $12.00 (1200) | Upgrade Basic → Pro — one-time |

Checkout uses `mode: "payment"` only. Annual/monthly lookup keys (`spl_annual`, `spl_vault_annual`, `spl_monthly`) are removed from code.

## How price IDs are chosen

1. Optional env overrides: `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_UPGRADE` (must start with `price_`)
2. Else `stripePriceId` → `ensureCatalogPrice` finds or creates the one-time price by lookup key (Test Mode)

Owner should create the three Test prices in the Stripe Dashboard (or let the first Test checkout create them). **Do not change Live Stripe prices in Phase 1.**

## Checkout body

```json
{ "product": "basic" | "pro" | "upgrade_to_pro", "licenseKey": "SPL-...." }
```

`licenseKey` is required for `upgrade_to_pro` and must be an active Basic license.

Success URL: `/thank-you?session_id={CHECKOUT_SESSION_ID}`

## Webhook

Handles `checkout.session.completed` (and async payment succeeded). Creates or upgrades a row in `licenses` and emails the key via Resend. Idempotent on `stripe_session_id`.

## Secrets

```
STRIPE_SECRET_KEY=rk_test_...   # Test only for Phase 1
STRIPE_WEBHOOK_SECRET=whsec_...
ADMIN_SECRET=...                # for admin-licenses (min 16 chars)
RESEND_API_KEY=...
APP_URL=https://safetypreplist.com
```

## Deploy (after migration applied)

```bash
supabase db push   # or apply 0047_licenses.sql
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy checkout-status
supabase functions deploy activate-license
supabase functions deploy deactivate-license
supabase functions deploy reset-license
supabase functions deploy admin-licenses
```

Point the **Test** webhook endpoint at `stripe-webhook` for `checkout.session.completed`.
