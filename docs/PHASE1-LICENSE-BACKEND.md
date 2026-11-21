# Phase 1 — License backend (complete, awaiting review)

**Stripe mode (historical Phase 1):** originally Test only.  
**Update:** Test Mode gate removed — see `docs/STRIPE.md` for Live setup. Coming Soon can still block purchases.

## Owner decisions applied
1. Slim admin via `admin-licenses` + `ADMIN_SECRET` (view / revoke). No discount/checklist admin rebuild.
2. Brevo / `subscribe-checklist` kept.
3. Safety resources → static JSON deferred to Phase 2/3 client work.
4. Print refund RPCs deferred to Phase 2/3 client + `legal.ts` (backend no longer depends on them for fulfillment).

## Added
| Path | Role |
|---|---|
| `supabase/migrations/0047_licenses.sql` | `licenses` + `license_devices`, RLS on, no client policies |
| `supabase/functions/_shared/licenses.ts` | Key gen `SPL-XXXX-…`, normalize, email helper |
| `supabase/functions/activate-license/` | POST `{ key, deviceId }` |
| `supabase/functions/deactivate-license/` | POST `{ key, deviceId }` |
| `supabase/functions/reset-license/` | POST `{ key, email }` — generic response; 5/key/hour |
| `supabase/functions/admin-licenses/` | POST `{ action: list\|revoke }` + `ADMIN_SECRET` |
| `docs/PHASE1-LICENSE-BACKEND.md` | This report |
| `docs/STRIPE.md` | Rewritten for one-time Test catalog |

## Changed
| Path | Change |
|---|---|
| `supabase/functions/_shared/stripe.ts` | `PRICE_LOOKUP` basic/pro/upgrade one-time; no monthly/annual |
| `supabase/functions/_shared/fulfill.ts` | License create / upgrade; idempotent on `stripe_session_id` |
| `supabase/functions/create-checkout-session/index.ts` | `mode: payment`; body `{ product, licenseKey? }`; Test Mode gate |
| `supabase/functions/stripe-webhook/index.ts` | `checkout.session.completed` only |
| `supabase/functions/checkout-status/index.ts` | Returns `{ licenseKey, product, … }` |
| `supabase/functions/.env.example` | Test + ADMIN_SECRET + new price env names |
| `supabase/config.toml` | New functions `verify_jwt = false`; PayPal entries removed |

## Deleted
- `activate-paypal-subscription`, `cancel-paypal-subscription`, `capture-paypal-order`, `create-paypal-order`, `create-paypal-subscription`, `paypal-webhook`, `purchase-device-slot`, `upgrade-plan`

## Migration
`0047_licenses.sql` creates:
- `licenses (id, license_key unique, product basic|pro, devices_allowed default 1, status active|revoked, email, stripe_session_id unique, created_at)`
- `license_devices (license_id, device_id, activated_at)` PK `(license_id, device_id)`
- RLS enabled; no policies (service role only)

## Not in Phase 1 (by design)
- Client UI / HomeV2 copy / `/activate` route
- `localStore.ts` / AppContext rewrite
- Live Stripe price archive
- Applying migration / deploying functions (owner ops)

## Owner next steps before accepting Phase 1
1. In **Stripe Test** Dashboard: create (or allow first checkout to create) the three one-time prices with lookup keys above.
2. `supabase db push` (or apply `0047_licenses.sql`).
3. Set secrets: Test `STRIPE_SECRET_KEY`, Test webhook secret, `ADMIN_SECRET`, Resend.
4. Deploy the functions listed in `docs/STRIPE.md`.
5. Manual Test checkout: Basic → webhook license + email → `checkout-status` returns key → activate twice OK, third 409 → reset → upgrade path.

**STOP — Phase 2 not started.**
