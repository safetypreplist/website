# AUDIT-ONE-TIME — Safety Prep List → one-time license model

**Phase:** 0 (read-only)  
**Date:** 2026-11-17  
**Repo:** Official Build  
**Rule:** No code changes in this phase. Owner must review and approve before Phase 1.

**Target model (from owner instructions):**
- Basic $12.99 one-time · Pro $24.99 one-time · Upgrade Basic→Pro $12.00 one-time
- No customer accounts · license key + device activation · local IndexedDB for user data
- Keep design, hero media, catalog/itemTips, print/PDF, offline, notes, contacts, safety resources, onboarding, Survival Vault *content*
- No live customers — delete annual/monthly/PayPal/account flows rather than migrate

---

## 0.3 Local data that currently depends on Supabase

Today the UI already has an IndexedDB layer (`src/lib/offlineStore.ts`, DB name `spl-offline`) used as an **offline cache + sync queue** keyed by `userId`. Authoritative writes still go to Supabase when online.

| Data the UI needs | Current source of truth | Offline today | Proposed for one-time model |
|---|---|---|---|
| Checklist progress (checks) | Supabase `checklist_progress` via RPC `save_progress` | Cached in snapshot + queued ops | **Local IndexedDB only** (`src/lib/localStore.ts`) |
| Notes on items | Same progress rows (`note` field) | Same queue | **Local IndexedDB only** |
| Custom items | Supabase `custom_checklist_items` via RPCs | Same queue | **Local IndexedDB only** |
| Household contacts | Supabase `contacts` table | Cached in snapshot; writes go online | **Local IndexedDB only** |
| Catalog (systems/sections/items) | Edge `checklist-library` (+ DB UUIDs remapped) | Cached in snapshot | **Static import** of `catalog.json` (+ tips) — replace function |
| Safety resources | Supabase `safety_contacts` select | Loaded at boot | **Keep as static/catalog data or ship with catalog** (decide in Phase 2; content exists in catalog) |
| Products / pricing rows | Supabase `products` | Boot load | **Delete dependency** — use `pricing.ts` + Stripe lookup keys |
| Profile / avatar / preferred state | Supabase `profiles` + Storage `avatars` | In snapshot | **Delete** (no accounts) |
| Devices (account slots) | Supabase `devices` + RPC `register_device` / `remove_device` | In snapshot | **Replace** with `license_devices` via Edge Functions |
| Access / plan / vault flags | RPC `my_access` + subscriptions | In snapshot | **Replace** with local license `{ key, product }` from activation |
| Family seats / invites / permissions | Tables + `family-invite` + RPCs | In snapshot | **Delete** |
| Print → refund window | RPC `record_print` / `my_refund_window` | N/A | **Replace or drop** — refund rules change under one-time; flag for legal |
| Terms acceptance | Edge `record-terms-acceptance` | Cookie/local flags also exist | **Replace** with local acceptance flag |
| Auth session | `supabase.auth` + `storedSession()` in offlineStore | Persisted session | **Delete** |

**Existing local primitives to reuse / reshape (not rebuild from zero):**
- `src/lib/offlineStore.ts` — already uses raw IndexedDB (no `idb-keyval` / Dexie in `package.json` yet). Snapshot + queue are auth-centric (`userId`). Phase 2 should introduce `src/lib/localStore.ts` as the new repository; offlineStore can be retired or slimmed.
- `src/lib/device.ts` — already persists a device token in `localStorage` (`spl.device.token.v1`). Phase 2’s `deviceId` (`crypto.randomUUID`) is similar; decide whether to reuse or replace the key name.
- Demo mode (`src/lib/demo.ts`, `sampleChecklist.ts`) already runs without paid library — pattern for “no account” UX.

---

## Master table — client / app files

| File | Purpose | Category | Proposed action |
|---|---|---|---|
| `src/lib/supabase.ts` | Browser Supabase client + `invokeFunction` | edge function (client glue) | **Replace** — keep a thin `invokeFunction` (or fetch wrapper) for remaining Edge Functions; drop anon auth client when auth is gone |
| `src/context/AppContext.tsx` | Auth, catalog load, progress/contacts/devices/family, Realtime, storage avatars, sync queue flush | auth / data / realtime / storage / edge | **Replace** internals — keep AppContext shell; remove auth/Realtime/Supabase data; wire `localStore` + `licenseClient` |
| `src/pages/Auth.tsx` | Sign-in, sign-up, reset/update password, join family, product-code signup | auth / data / edge | **Delete** (with routes) |
| `src/pages/Account.tsx` | Account settings; PayPal cancel; delete-account | auth / edge | **Delete** |
| `src/pages/Billing.tsx` | Billing UI; `my_billing`; Stripe portal | data / edge | **Delete** |
| `src/pages/Family.tsx` | Family plan management; checkout-status for seats | data / edge | **Delete** |
| `src/pages/AccessEnded.tsx` | Renew / access ended | data | **Delete** (no subscriptions) |
| `src/pages/Purchase.tsx` / checkout UI | Annual/family checkout; discount preview; thank-you fulfillment | edge | **Replace** — Basic/Pro/upgrade one-time; remove family qty & annual copy |
| `src/components/StripeCheckout.tsx` | Invokes `create-checkout-session` | edge | **Replace** body shape (`product`, optional `licenseKey`) |
| `src/components/FamilySeatSetup.tsx` | Name/invite family seats | edge / data | **Delete** |
| `src/components/AdminAccounts.tsx` | Admin account list / password reset via `admin-account-control` | edge / auth | **Delete** |
| `src/components/AdminRefunds.tsx` | Admin refunds via `admin-refunds` | edge | **Keep or replace** — still useful for one-time refunds; revisit after legal |
| `src/pages/Admin.tsx` | Owner tools: discounts, checklist edit, safety contacts, coming soon, help FAQs, onboarding config | data | **Keep (owner)** short-term; many writes assume Supabase tables — **replace or slim** in a later owner-tools pass (not blocking license MVP if admin stays service-role only) |
| `src/pages/Help.tsx` | Help FAQs from `app_config`; support-ticket | data / edge | **Keep** contact/help path; FAQ source may move static |
| `src/pages/Contact.tsx` | Contact form → `send-contact` | edge | **Keep** |
| `src/lib/comingSoon.ts` | Reads `app_config` coming-soon flag | data | **Keep or replace** with static/env flag |
| `src/components/OnboardingTour.tsx` | Reads onboarding copy/video from `app_config` | data | **Keep** tour UX; copy may become static defaults (**keep**) |
| `src/lib/printTracking.ts` | `record_print` / `my_refund_window` | data | **Replace / delete** under new refund policy |
| `src/lib/refunds.ts` | Pending refund count for admin badge | data | **Keep** if admin refunds kept |
| `src/lib/legalConsent.ts` | Local flags + `record-terms-acceptance` | edge | **Replace** — local flag only |
| `src/lib/subscribe.ts` | Brevo free docs list via `subscribe-checklist` | edge | **Delete or keep** — owner decision (Phase 3.2 says delete if free signup not kept) |
| `src/lib/offlineStore.ts` | IndexedDB snapshots + sync queue (auth-scoped) | data (local) | **Replace** with `localStore.ts` (no sync-to-Supabase) |
| `src/lib/device.ts` | Device token in localStorage for `register_device` | data (local) | **Replace / adapt** for license `deviceId` |
| `src/lib/accessPolicy.ts` | Access/vault gating from subscription state | data | **Replace** with Basic vs Pro license product |
| `src/lib/demo.ts` | Demo mode without paid catalog | keep | **Keep** |
| `src/lib/sampleChecklist.ts` | Public sample content | keep | **Keep** |
| `src/data/catalog.json` | Checklist catalog | keep | **Keep** (serve statically) |
| `src/data/itemTips.ts` | Tips | keep | **Keep** |
| `src/pages/HomeV2.tsx` + `home-v2.css` | Marketing homepage | keep | **Keep** design; **replace** copy/pricing in Phase 4 |
| `src/App.tsx` | Routes + auth gates | auth | **Replace** gates with `isLicensed()`; add `/activate`, `/app/reset-devices`; delete account/family routes |
| `scripts/publish-public-routes.mjs` | SPA shells for Pages | keep | **Replace** route list (add `activate`; drop deleted public routes) |
| `public/sitemap.xml` | SEO | keep | **Replace** entries per Phase 3.4 |

---

## Edge Functions (`supabase/functions/*/index.ts`)

| File | Purpose | Category | Proposed action |
|---|---|---|---|
| `create-checkout-session/index.ts` | Stripe Checkout for annual/monthly/vault/family | edge function | **Replace** — `mode: "payment"`; products basic/pro/upgrade_to_pro |
| `stripe-webhook/index.ts` | Fulfill subscriptions + invoices + subscription lifecycle | edge function | **Replace** — `checkout.session.completed` only; create/upgrade licenses; email key |
| `checkout-status/index.ts` | Poll/fulfill session; return purchase receipt | edge function | **Replace** — return license key for thank-you page |
| `create-portal-session/index.ts` | Stripe Customer Portal | edge function | **Delete** |
| `preview-discount/index.ts` | Discount preview for annual checkout | edge function | **Delete** |
| `send-account-email/index.ts` | Welcome email after signup | edge function | **Delete** |
| `delete-account/index.ts` | Account deletion + cancel remote sub | edge function | **Delete** |
| `record-terms-acceptance/index.ts` | Persist terms rows | edge function | **Delete** (local flag) |
| `family-invite/index.ts` | Invite/resend/cancel family seats | edge function | **Delete** |
| `checklist-library/index.ts` | Auth-gated catalog with DB UUID remap | edge function | **Delete** — static JSON import |
| `admin-account-control/index.ts` | List users / reset passwords | edge function | **Delete** |
| `cancel-paypal-subscription/index.ts` | Legacy PayPal cancel | edge function | **Delete** |
| `create-paypal-order/index.ts` | Legacy PayPal one-time | edge function | **Delete** |
| `create-paypal-subscription/index.ts` | Legacy PayPal sub | edge function | **Delete** |
| `capture-paypal-order/index.ts` | Legacy PayPal capture | edge function | **Delete** |
| `activate-paypal-subscription/index.ts` | Legacy PayPal activate | edge function | **Delete** |
| `paypal-webhook/index.ts` | Legacy PayPal webhooks | edge function | **Delete** |
| `purchase-device-slot/index.ts` | Paid extra device (legacy) | edge function | **Delete** |
| `upgrade-plan/index.ts` | Legacy PayPal upgrade | edge function | **Delete** |
| `subscribe-checklist/index.ts` | Brevo free list signup | edge function | **Delete or keep** (owner call) |
| `send-contact/index.ts` | Contact form email | edge function | **Keep** |
| `support-ticket/index.ts` | Help ticket + LiveAgent | edge function | **Keep** |
| `admin-refunds/index.ts` | Owner refund tooling | edge function | **Keep / adapt** for one-time payments |
| *(new)* `activate-license` | Activate key + device | edge function | **Add** (Phase 1.8) |
| *(new)* `deactivate-license` | Remove device row | edge function | **Add** (Phase 1.9) |
| *(new)* `reset-license` | Email+key recovery reset devices | edge function | **Add** (Phase 1.10) |

---

## Shared Edge modules (`supabase/functions/_shared/`)

| File | Purpose | Category | Proposed action |
|---|---|---|---|
| `stripe.ts` | PRICE_LOOKUP annual/monthly/vault; `ensureCatalogPrice`; Stripe API | edge | **Replace** — basicLifetime / proLifetime / upgradeBasicToPro; one_time support |
| `fulfill.ts` | Checkout fulfillment for subscriptions | edge | **Replace** — license create/upgrade + email key |
| `subscriptions.ts` | Subscription row sync/lifecycle | edge | **Delete** |
| `billing.ts` | Access interval / PayPal custom id helpers | edge | **Delete / slim** |
| `paypal.ts` | PayPal API | edge | **Delete** |
| `activation.ts` | Activate remote subscription | edge | **Delete** (name collision with new license activate) |
| `cancelRemote.ts` | Cancel Stripe/PayPal | edge | **Delete** |
| `discounts.ts` | Discount codes | edge | **Delete** (unless owner keeps promos later) |
| `productCode.ts` | Post-purchase product codes for account create | edge | **Delete** |
| `quantity.ts` | Family quantity parsing | edge | **Delete** |
| `refundAccess.ts` | Refund access helpers | edge | **Adapt or delete** |
| `supabase.ts` | Service + user clients; `requireUser` | edge | **Keep** service client; drop `requireUser` auth dependency where possible |
| `email.ts` | Resend helper | edge | **Keep** — used to email license keys |
| `http.ts` | CORS / JSON helpers | edge | **Keep** |
| `rateLimit.ts` | Rate limits | edge | **Keep** — used by reset-license |
| `brevo.ts` | Brevo contacts | edge | **Keep if** subscribe kept; else unused |
| `liveagent.ts` | LiveAgent | edge | **Keep** (support-ticket) |
| `comingSoon.ts` | Coming-soon gate | edge | **Keep or replace** |
| `catalog.json` | Bundled catalog for checklist-library | keep | **Keep** as static asset / import for client |
| `comingSoon.test.ts` | Unit test | keep | **Keep** if coming-soon kept |

---

## Auth / Realtime / Storage call sites (grep summary)

| API | Files |
|---|---|
| `supabase.auth.*` | `AppContext.tsx`, `Auth.tsx`, `_shared/supabase.ts` (getUser) |
| `supabase.from(...)` | `AppContext.tsx`, `Admin.tsx`, `Help.tsx`, `comingSoon.ts`, `OnboardingTour.tsx`, `refunds.ts`, Edge functions (many) |
| `supabase.rpc(...)` | `AppContext.tsx`, `Auth.tsx`, `Billing.tsx`, `printTracking.ts` |
| `supabase.storage` | `AppContext.tsx` (avatars only) |
| `supabase.channel` / Realtime | `AppContext.tsx` only (`account-sync` on progress, contacts, devices, custom items) |
| `supabase.functions.invoke` / `invokeFunction` | `supabase.ts`, StripeCheckout, Purchase, Family, Billing, Account, Help, Contact, AppContext, FamilySeatSetup, AdminAccounts, AdminRefunds, legalConsent, subscribe |

---

## Routes impacted (for Phase 2–3 planning)

| Route | Action |
|---|---|
| `/signin`, `/reset-password`, `/update-password`, `/create-account`, `/join`, `/invite/:token` | **Delete** |
| `/app/family`, `/app/family/connected`, `/app/access`, `/app/account`, `/app/billing`, `/app/billing/receipt/:id`, `/app/renew`, `/app/devices` | **Delete** |
| `/activate` | **Add** |
| `/app/reset-devices` | **Add** (replaces `/app/devices`) |
| `/thank-you` | **Replace** — show license key; no `/create-account` |
| `/`, `/classic`, `/pricing`, `/checkout`, `/demo`, `/install`, `/contact`, `/privacy`, `/terms`, `/app/*` core lists, `/app/survival` | **Keep** (pricing/checkout copy + gating change) |
| `/admin` | **Keep for now** (owner); account sub-UI deleted |

---

## Stripe price selection today (baseline before Phase 1)

| Step | Location | Behavior |
|---|---|---|
| UI default | `pricing.ts` `PUBLIC_ACCESS = "annual"` → `StripeCheckout` | Sends `accessInterval: "annual"` |
| Server force | `create-checkout-session` | New checkouts forced annual; monthly only if `renew` |
| Lookup keys | `_shared/stripe.ts` `PRICE_LOOKUP` | `spl_annual`, `spl_vault_annual`, `spl_monthly` |
| Resolve ID | `stripePriceId` | Env override `STRIPE_PRICE_*` **or** `ensureCatalogPrice` (creates recurring yearly/monthly if missing) |

Phase 1 replaces this with one-time lookup keys: `spl_basic_lifetime` (1299), `spl_pro_lifetime` (2499), `spl_upgrade_basic_pro` (1200), `mode: "payment"`.

---

## Risks / decisions for owner review

1. **Admin surface:** Instructions delete AdminAccounts but leave general Admin. Discount codes, live checklist edits, and `app_config` still need a backend. Confirm: keep Supabase service-role admin for owner-only tools, or cut Admin to static until rebuilt?
2. **Free documents signup (`subscribe-checklist` / Brevo):** keep or delete?
3. **`safety_contacts`:** currently DB-backed; catalog also has safety rows. Prefer static ship with app?
4. **Refund + print tracking:** annual refund window RPCs won’t apply; legal DRAFT update required before publishing copy.
5. **Coming Soon + onboarding remote config:** keep Supabase `app_config` reads or freeze into code?
6. **Existing IndexedDB:** already present — Phase 2 should migrate shapes carefully so demo/offline UX doesn’t regress.
7. **No live customers claimed** — safe to delete PayPal/subscription code paths; still archive Stripe annual prices in Dashboard (owner, Test then Live).

---

## Owner decisions (approved 2026-11-17)

1. **Admin:** Slim owner-only page — view/revoke licenses via `ADMIN_SECRET` (not account login). No discount/checklist admin rebuild now.
2. **Brevo:** Keep `subscribe-checklist` + `brevo.ts`.
3. **Safety resources:** Move to static JSON in a later phase; remove `safety_contacts` dependency then.
4. **Refunds/print:** Remove print-based refund window in client phases; `legal.ts` will state 7-day refund unless license activated — DRAFT + attorney review. Do not publish as final.

Also: do not delete `offlineStore.ts` until `localStore.ts` works (migrate IndexedDB). Phase 1 = Stripe **Test** only. Commit phases separately.

## Phase 0 complete → Phase 1

Phase 1 backend implemented; see `docs/PHASE1-LICENSE-BACKEND.md`.
