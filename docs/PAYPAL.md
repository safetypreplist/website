# PayPal (legacy)

New checkout uses Stripe. See [docs/STRIPE.md](STRIPE.md).

PayPal Edge Functions remain only so existing PayPal subscriptions can cancel, refund, and receive webhooks. Do not add `VITE_PAYPAL_CLIENT_ID` for new work. Never put a PayPal secret in a `VITE_` variable.
