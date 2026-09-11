# Safety Prep List

Hope for the best. Prepare for the rest.

**Safety Prep List** is a mobile-first preparedness web application. It is not an ebook. Customers create an account, work living checklists, leave short notes, print a system when needed, keep household emergency contacts, and sync everything across registered devices.

This repository is the GitHub-ready production app:

- React + TypeScript frontend (GitHub Pages + custom domain)
- Supabase Auth, Postgres, Row Level Security, Realtime
- PayPal checkout with **server-side capture verification** (Supabase Edge Functions)
- Device slots (2 included per login; no paid extra devices)
- PWA (Add to Home Screen)

## Quick start (local)

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app will load without secrets, but login, sync, and PayPal stay inactive until you add credentials.

## What you must supply

Nothing secret belongs in the frontend or in git. You will add:

| Credential | Where it goes | Public? |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` and GitHub Actions secret | Yes (URL) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` and GitHub Actions secret | Yes (anon key + RLS) |
| `VITE_PAYPAL_CLIENT_ID` | `.env.local` and GitHub Actions secret | Yes (client id only) |
| `PAYPAL_CLIENT_SECRET` | `supabase secrets set` | **Never** in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected automatically into Edge Functions | **Never** in the browser |
| `RESEND_API_KEY` | `supabase secrets set` | **Never** in the browser |
| `BREVO_API_KEY` | `.env.local` (no `VITE_` prefix) for local, then `supabase secrets set` for the live site | **Never** in the browser |
| `BREVO_LIST_ID` | same places as `BREVO_API_KEY` | List number only |
| `EMAIL_FROM` | `supabase secrets set` | From-address only |
| `APP_URL` | Edge Function secret + `VITE_APP_URL` | Your public domain |

Follow the setup docs in order:

1. [docs/SUPABASE.md](docs/SUPABASE.md) — project, schema, RLS, seed data, Auth
2. [docs/PAYPAL.md](docs/PAYPAL.md) — live PayPal app, Edge Functions, verification
3. [docs/EMAIL.md](docs/EMAIL.md) — Resend transactional purchase email
4. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub Pages + custom `.com` domain
5. [docs/ADMIN.md](docs/ADMIN.md) — editing checklists, vault, and safety resources

## Product

| Product | Price | Entitlement |
|---|---|---|
| Monthly | $11.99 per person / month | One personal Safety Prep Checklist per person, notes, contacts, 2 devices, 5 custom items per section |
| Annual | $9.99/month per person, billed annually ($119.88/year) | Same as Monthly. Save $2/month per person. |
| Family Plan | Same per-person price | Connected individual checklists — not one shared list |
| Survival Vault | $10 one-time add-on | Advanced preparedness resources + How-To Videos. Not recurring. One purchase per family. |

Due today = the Monthly or Annual subscription total + optional Survival Vault. Renewals charge the subscription only.

Prices live in the `products` table. Change them in Supabase without rebuilding the frontend math.

## Architecture

```
GitHub Pages (this app)
    │  anon key only
    ▼
Supabase
    ├─ Auth
    ├─ Postgres + RLS
    └─ Edge Functions
           ├─ create-paypal-order
           ├─ capture-paypal-order   ← verifies amount server-side
           ├─ purchase-device-slot
           ├─ upgrade-plan
           └─ subscribe-checklist    ← Brevo mailing list (API key stays on the server)
```

PayPal secrets stay in Edge Functions. The Brevo API key stays in Edge Functions (live) or `.env.local` without a `VITE_` prefix (local).

The browser never sees PayPal’s secret, the service role key, or the email API key.

## Scripts

```bash
python3 scripts/generate_seed.py   # rebuild supabase/seed.sql
npm run build                      # production bundle in dist/
```

## Brand

Primary colors are defined in `src/styles/app.css`:

`#1E2A1F` forest · `#556B2F` moss · `#A67C52` clay · `#C75A2B` terracotta · `#E6E2D6` sand · `#F4F0E5` cream

Headings: Oswald. Body: Inter.

Illustration slots are vintage field-guide placeholders (backpack, duffel, SUV, cabin, and related motifs). Replace the SVG components in `src/components/Illustrations.tsx` with final art when it is ready.
