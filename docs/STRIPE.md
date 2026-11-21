# Stripe — one-time licenses (Live ready)

Checkout accepts **Test** or **Live** keys. Mode is determined solely by which `STRIPE_SECRET_KEY` you set on Supabase Edge Functions (`rk_test_` / `sk_test_` vs `rk_live_` / `sk_live_`). Prefer a [restricted API key (RAK)](https://docs.stripe.com/keys/restricted-api-keys) (`rk_…`) over an unrestricted secret key.

> **Coming Soon / Maintenance Mode:** `create-checkout-session` still calls `comingSoonBlock`. If Maintenance Mode is on in Admin, new visitors cannot buy until you turn it off — even with Live keys.

## Products (lookup keys)

| Lookup key | Amount | Product |
|---|---|---|
| `spl_basic_lifetime` | $12.99 (1299) | Basic — one-time |
| `spl_pro_lifetime` | $24.99 (2499) | Pro — one-time |
| `spl_upgrade_basic_pro` | $12.00 (1200) | Upgrade Basic → Pro — one-time |

### Group Sharing (one Stripe product, nine one-time prices)

Product name: **SafetyPrepList Group Sharing** (catalog id `spl_group_sharing` when auto-created).

| Lookup key | Amount | Devices | Duration |
|---|---|---|---|
| `spl_group_2_7d` | $5.99 (599) | 2 | 7 days |
| `spl_group_2_14d` | $9.99 (999) | 2 | 14 days |
| `spl_group_2_30d` | $14.99 (1499) | 2 | 30 days |
| `spl_group_3_7d` | $7.99 (799) | 3 | 7 days |
| `spl_group_3_14d` | $12.99 (1299) | 3 | 14 days |
| `spl_group_3_30d` | $17.99 (1799) | 3 | 30 days |
| `spl_group_4_7d` | $9.99 (999) | 4 | 7 days |
| `spl_group_4_14d` | $14.99 (1499) | 4 | 14 days |
| `spl_group_4_30d` | $19.99 (1999) | 4 | 30 days |

Checkout uses `mode: "payment"` only. Annual/monthly lookup keys are not used.

**Retired from new purchases:** `spl_basic_additional` (Additional Device $9.99). Do not offer it in the Dashboard for new sales. Historical fulfill still recognizes old sessions.

Test and Live catalogs are **separate**. Recreate (or let first Live checkout create) the same lookup keys in Live mode. Do not reuse Test `price_…` IDs in Live.

## How price IDs are chosen

1. Optional env overrides for lifetime: `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_UPGRADE` (must start with `price_`)
2. Optional Group Sharing overrides: `STRIPE_PRICE_GROUP_2_7D` … `STRIPE_PRICE_GROUP_4_30D` (same pattern; must start with `price_`)
3. Else `stripePriceId` → `ensureCatalogPrice` finds or creates the one-time price by lookup key in the mode of the configured secret

**Recommendation:** Prefer lookup keys (leave overrides unset). Create the Dashboard prices with the lookup keys above, or let the first checkout in that mode create matching catalog prices. Do not hardcode `price_…` IDs in app source.

## Checkout body

```json
{ "product": "basic" | "pro" | "upgrade_to_pro", "licenseKey": "SPL-...." }
```

Group Sharing:

```json
{
  "product": "group_sharing",
  "groupDevices": 2,
  "groupDurationDays": 7,
  "licenseKey": "SPL-....",
  "deviceId": "…",
  "origin": "https://safetypreplist.com"
}
```

`licenseKey` is required for `upgrade_to_pro` and Group Sharing. Group Sharing also requires the activated `deviceId` on that license.

Success URL (licenses): `/thank-you?session_id={CHECKOUT_SESSION_ID}`  
Success URL (Group Sharing): `/thank-you?session_id={CHECKOUT_SESSION_ID}&kind=group`

## Webhook

Handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Creates or upgrades a row in `licenses` (or a `sharing_groups` row for Group Sharing) and emails license keys via Resend when applicable. Idempotent on `stripe_session_id`.

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
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_UPGRADE=price_...
STRIPE_PRICE_GROUP_2_7D=price_...
# …through STRIPE_PRICE_GROUP_4_30D
```

## Go Live checklist (owner)

Follow Stripe’s [go-live checklist](https://docs.stripe.com/get-started/checklist/go-live). Practical steps for this app:

1. **Stripe Dashboard → Live mode** (toggle off “Test mode”).
2. Confirm the account can accept live payments (business details / payouts as required by Stripe).
3. **Products / Prices (Live):** create one-time USD prices with lookup keys above (or skip and let first checkout create them). Match amounts exactly. For Group Sharing, create **one product** with **nine prices**.
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

   Clear any Test-only `STRIPE_PRICE_*` overrides, or set them to the matching **Live** `price_…` IDs. Remove obsolete `STRIPE_PRICE_BASIC_ADDITIONAL` if set.
7. **Deploy** the checkout + webhook functions after this code lands:

   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook
   supabase functions deploy checkout-status
   supabase functions deploy group-sharing
   ```

8. **Maintenance Mode:** in Admin, turn Coming Soon / Maintenance Mode **off** before expecting public purchases.
9. **Verify carefully:** a Live checkout charges a real card. Prefer a small real purchase you control only when ready; confirm webhook → license or group row → email/activate. Refund in Dashboard if it was only a smoke test.

## Deploy (functions)

```bash
supabase db push   # applies 0054_group_sharing and prior migrations
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy checkout-status
supabase functions deploy group-sharing
supabase functions deploy activate-license
supabase functions deploy deactivate-license
supabase functions deploy reset-license
supabase functions deploy admin-licenses
```
