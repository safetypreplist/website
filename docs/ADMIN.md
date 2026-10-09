# Owner console

Grant owner access in SQL only:

```sql
update public.profiles
set role = 'owner'
where email = 'you@yourdomain.com';
```

Then sign in and open `/admin`. The console only shows live tools:

| Tab | What it does |
|---|---|
| Accounts & access | Real customer accounts. Reset passwords through the owner-only edge function. |
| Discount codes | Live checkout codes. PayPal charges the discounted subscription amount. Survival Vault is never discounted. |
| Support chats | Tawk.to visitors from the webhook table. |
| Checklist & resources | Edit item wording and add verified safety resources. |
| Onboarding | Tour copy stored in `app_config` and shown to every customer. |

Do **not** change `checklist_items.permanent_key` for an existing item.

## Discount codes

Create codes in the owner console. `READY10` (10% all plans) and `FAMILY25` (25% family) ship as examples. `WELCOME5` is stored but off.

Three code types: percent off, fixed dollars off, or set price. A set price is the subscription payment per checklist (a 2-person Family plan pays twice the set price). Set price needs migration `0024_discount_set_price.sql`.

**Discounted payments** is how many subscription payments get the discount once a customer subscribes (1 = first payment only; 3 on Monthly = first 3 months). It is copied onto the purchase as `purchases.discount_payments` so renewals can honor it. **Code expires** only stops new customers from using the code. Needs migration `0025_discount_duration.sql`.

Automatic renewal charges are not wired yet. Until they are, only the first payment is actually charged.

Checkout calls `preview-discount`, then `create-paypal-order` / `capture-paypal-order` re-check the same code before charging.

## Bulk content (Supabase Table Editor)

| Table | Purpose |
|---|---|
| `checklist_systems` | Grab & Go Bag, Ready Duffel, Survival Vault lists, `access_tier`, `sort_order`, `active` |
| `checklist_sections` | Categories inside a system |
| `checklist_items` | `permanent_key`, wording, `sort_order`, `active` |
| `safety_contacts` | National and state records; include `source_url` and `verified_at` |
| `products` | Amounts in cents |
| `discount_codes` | Checkout offers |
| `app_config` | Pricing JSON and onboarding copy |

## Safety directory policy

Do not invent phone numbers. Seed data includes Ready.gov, SAMHSA/988, Poison.org, FEMA, and official state emergency-management websites. Add a state-specific phone only after you confirm it on that agency’s current public page.

## How-To Videos

How-To Videos is one YouTube playlist, managed directly on YouTube: https://www.youtube.com/playlist?list=PLU4fSfttZ8NU. The app only links to it (`HOW_TO_PLAYLIST_URL` in `src/lib/copy.ts`). There is no admin video tool, and the app no longer reads the old `video_resources` table.

## Devices

Customers get 2 slots. They can rename or remove a registration. The raw device token never leaves the device; only a SHA-256 hash is stored.
