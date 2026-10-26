# Stripe setup

New purchases use Stripe Checkout and Stripe Billing. Secrets stay on Edge Functions. The GitHub Pages frontend never receives `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`.

Do not enable `automatic_tax` until Stripe Tax registrations (or Managed Payments) are actually active on the account. Selecting a digital-sales option in onboarding is not enough.

Checkout uses whichever key is on the server. A `rk_test_` / `sk_test_` key is Test Mode. A `rk_live_` / `sk_live_` key is live and charges real cards. Test prices cannot be reused in live; the first live checkout creates `spl_monthly`, `spl_annual`, and `spl_vault` on the live account.

## Test Mode catalog (already created)

| Lookup key | Amount | Interval |
|---|---|---|
| `spl_monthly` | $7.99 | legacy month (not sold for new checkouts) |
| `spl_annual` | $29.99 | year per checklist (public offer) |
| `spl_vault` | $10.00 | one-time Survival Vault |

New checkouts are annual-only at $29.99 per checklist. If `spl_annual` already exists at an older amount, the server creates a new Stripe price and moves the `spl_annual` lookup key onto it. Clear `STRIPE_PRICE_ANNUAL` if that env still points at an old price id.

## Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=rk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set APP_URL=https://safetypreplist.com
```

Use a [restricted key](https://docs.stripe.com/keys.md#manage-your-api-keys) (`rk_live_` in production) with:

**Write:** Checkout Sessions, Customers, Subscriptions, Coupons, Customer portal sessions, Refunds (admin only)

**Read:** Products, Prices, Invoices, Payment methods, Events

After you switch to live keys, register a **Live** webhook endpoint (Test endpoints do not receive live events) at the same URL, then put that endpoint’s signing secret in `STRIPE_WEBHOOK_SECRET`. Enable the Customer Portal in the Live Dashboard as well.

## Database

Apply `supabase/migrations/0044_stripe_billing.sql` on the Supabase project.

## Deploy functions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy checkout-status
supabase functions deploy stripe-webhook
supabase functions deploy create-portal-session
supabase functions deploy cancel-paypal-subscription
supabase functions deploy admin-refunds
supabase functions deploy delete-account
```

Webhook URL:

`https://rhjarmxgglvwcxiwqcsq.supabase.co/functions/v1/stripe-webhook`

Copy the endpoint’s signing secret into `STRIPE_WEBHOOK_SECRET`. Do not commit it.

## Customer Portal

Enable the Customer Portal in the Stripe Dashboard (Test) so “Change payment method” on Billing can open a portal session. Until that Dashboard config exists, the portal call will fail even if the function is deployed.

## Tax

Stripe Tax / Managed Payments is not wired. `automatic_tax` is off. If you sell in the US or EU, review [Collect taxes for recurring payments](https://docs.stripe.com/billing/taxes/collect-taxes.md) before collecting tax.

## Legacy PayPal

Existing PayPal subscriptions can still cancel, refund, and receive PayPal webhooks if PayPal secrets remain on the project. New checkout no longer starts PayPal.
