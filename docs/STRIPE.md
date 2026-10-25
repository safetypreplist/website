# Stripe setup

New purchases use Stripe Checkout and Stripe Billing. Secrets stay on Edge Functions. The GitHub Pages frontend never receives `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`.

Do not enable `automatic_tax` until Stripe Tax registrations (or Managed Payments) are actually active on the account. Selecting a digital-sales option in onboarding is not enough.

Checkout uses whichever key is on the server. A `rk_test_` / `sk_test_` key is Test Mode. A `rk_live_` / `sk_live_` key is live and charges real cards. Test prices cannot be reused in live; the first live checkout creates `spl_monthly`, `spl_annual`, and `spl_vault` on the live account.

## Test Mode catalog (already created)

| Lookup key | Amount | Interval |
|---|---|---|
| `spl_monthly` | $7.99 | month per checklist |
| `spl_annual` | $79.99 | year per checklist |
| `spl_vault` | $10.00 | one-time Survival Vault |

LAUNCH26 ($4.99 first month) still lives in `discount_codes` and is attached only to `https://safetypreplist.com/launch26`. Checkout from that page sends `from=launch26`. The homepage cannot apply LAUNCH26. Checkout creates a one-invoice Stripe coupon for the subscription discount only, so Survival Vault stays $10. Cancel from that session returns to `/launch26#plans`.

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
