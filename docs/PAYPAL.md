# PayPal setup

PayPal is the only live processor. The payment module is isolated in Edge Functions so Stripe can be added later as another `provider` on `purchases` without rewriting the app.

Never put the secret in `VITE_` variables, GitHub Pages, or source control.

## Live (production)

1. Open [PayPal Developer](https://developer.paypal.com/dashboard/) and switch the toggle to **Live**
2. Apps & Credentials → **Live** → Create App (type: Merchant), or open your existing live app
3. Copy **Client ID** into:
   - `VITE_PAYPAL_CLIENT_ID` in `.env.local`
   - `PAYPAL_CLIENT_ID` (Edge Function secret)
4. Copy **Secret** into **only** `PAYPAL_CLIENT_SECRET` (Edge Function secret)
5. Set `PAYPAL_ENV=live` and `VITE_PAYPAL_ENV=live`
6. Redeploy Edge Functions and the GitHub Pages build
7. In the live PayPal app, add return URLs for your public site (and localhost if you still test locally)

Sandbox client IDs do not work in live mode. Use a real PayPal account on the live buttons, not a sandbox Personal login.

## Sandbox (development)

1. Same dashboard → switch the toggle to **Sandbox**
2. Apps & Credentials → **Sandbox** → Create App (type: Merchant)
3. Copy **Client ID** into:
   - `VITE_PAYPAL_CLIENT_ID` (frontend)
   - `PAYPAL_CLIENT_ID` (Edge Function secret)
4. Copy **Secret** into **only** `PAYPAL_CLIENT_SECRET` (Edge Function secret)
5. Set `PAYPAL_ENV=sandbox` and `VITE_PAYPAL_ENV=sandbox`

## How checkout works

## How checkout works

1. The browser asks `create-paypal-order` for a product slug (`core` or `upgrade_full`) plus `quantity`, `includeHousehold`, and `accessInterval` (`monthly` or `annual`).
2. The function looks up **price in the database**, not the UI.
3. For a new plan (`core`), the captured amount is:

   `Monthly ($11.99) or Annual ($119.88) × people` + optional Survival Vault (`$10` once, never multiplied by family size)
4. PayPal creates an order for that **due today** amount.
5. The PayPal Buttons SDK collects payment.
6. The browser sends the `orderId` to `capture-paypal-order`.
7. The function **captures and verifies** with PayPal:
   - status is COMPLETED
   - captured amount equals the due-today total above
8. A Product ID such as `RDM-7K4F-92LX` is generated server-side and stored on `purchases`.
9. A thank-you email is sent (if Resend is configured).
10. Account creation includes `product_code` in user metadata so the purchase is linked automatically.

Existing `plan = core` or `plan = full` customers are grandfathered. Do not auto-enroll them in a new subscription or re-charge Survival Vault.

The app does **not** trust query-string “success” flags.

Renewals (when wired) charge the subscription only. Survival Vault never renews.

## Additional device ($5)

Logged-in customers pay `extra_device`. Capture runs `apply_purchase_entitlements`, which does `device_limit = device_limit + 1`. No second account is created.

## Upgrade price

`products.slug = upgrade_full` and `app_config.pricing.upgrade_core_to_full.amount_cents` control the Core → Full upgrade. Change the row in Supabase; do not hardcode the difference in the frontend.
