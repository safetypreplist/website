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
| Accounts & access | Real customer accounts, including whether each one has printed a checklist. Reset passwords through the owner-only edge function. |
| Refund requests | Requests from the contact form's "Refund request" topic. Shows the first purchase date, the 3-day window, and print history, then refunds through PayPal or closes the request. |
| Discount codes | Live checkout codes. PayPal charges the discounted subscription amount. Survival Vault is never discounted. |
| Checklist & resources | Edit item wording and add verified safety resources. |
| Onboarding | Tour copy stored in `app_config` and shown to every customer. |

Do **not** change `checklist_items.permanent_key` for an existing item.

## Discount codes

Create codes in the owner console. `READY10` (10% all plans) and `FAMILY25` (25% family) ship as examples. `WELCOME5` is stored but off.

Three code types: percent off, fixed dollars off, or set price. A set price is the subscription payment per checklist (a 2-person Family plan pays twice the set price). Set price needs migration `0024_discount_set_price.sql`.

**Discounted payments** is how many subscription payments get the discount once a customer subscribes (1 = first payment only; 3 on Monthly = first 3 months). It is copied onto the purchase as `purchases.discount_payments` so renewals can honor it. **Code expires** only stops new customers from using the code. Needs migration `0025_discount_duration.sql`.

Plans are PayPal Subscriptions, so PayPal charges renewals automatically. A discount becomes a trial period on the subscription (for example LAUNCH26 is one $4.99 month per checklist, then $7.99; it is set to Monthly billing only, so it does not apply to Annual). A code's Billing setting (Monthly or Annual, Monthly only, Annual only) is checked on the server at checkout. Price changes only affect new checkouts; existing subscribers keep the price their PayPal plan was created with, and the Survival Vault is a one-time setup fee on the first payment. PayPal billing plans are created on demand and their IDs are stored in `paypal_billing_refs`; the `paypal-webhook` function keeps `subscriptions.paid_through` current. Access ends at the paid-through date after a cancellation, or 3 days after it when a payment fails. Accounts that paid before subscriptions launched are grandfathered with no expiry. Needs migration `0028_paypal_subscriptions.sql`.

Checkout calls `preview-discount`, then `create-paypal-order` / `capture-paypal-order` re-check the same code before charging.

## Refunds and printing

The Refund Policy allows a refund within 3 days of the first purchase, as long as no checklist has been printed or saved as a PDF. Checklist pages record every print in `print_events`: the Print button, the Ctrl/⌘+P shortcut, and the browser's own print menu. The app can only see that the print window opened, not whether paper came out. While a customer is still eligible, the Print button and the shortcut ask them to confirm first. A print from the browser menu can't be stopped, so the page tells them afterward.

Refund requests from `/contact?topic=refund` are saved to `refund_requests` and still create a LiveAgent ticket. The **Refund requests** tab and the Owner Console link show a count of waiting requests. **Refund through PayPal** sends the money back with the `admin-refunds` edge function, cancels the subscription, ends access immediately (`subscriptions.refunded_at`), and removes the Survival Vault it paid for. **I refunded it in PayPal** closes a request you handled in PayPal and can end access the same way. **Deny** closes it without changes; reply to the customer in LiveAgent either way. Needs migration `0034_refunds_and_prints.sql`.

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

## Devices

Each login gets 2 devices. The limit is per login, not per checklist or per family: a parent and child with separate logins each get 2, and two people sharing one login share its 2. Family pricing does not change the limit. The raw device token never leaves the device; only a SHA-256 hash is stored.

- `register_device` enforces the limit on the server, and every checklist save checks that the device is registered. An unregistered device can still open what it already has saved, but its changes stay queued on the device with an explanation until a slot is free.
- Removing a device (`remove_device`, migration `0038_device_sessions.sql`) signs out only that device's session. The customer's other devices stay signed in. If the removed device had changes waiting to sync, they stay on it and sync after the customer signs in there again.
- On Android and computers, the website and the installed app share storage, so they count as one device. On iPhone and iPad, Safari and the Home Screen app keep separate storage, so they count as two. The Devices page explains this.
- Accounts that already had a higher `device_limit` keep it.

## Offline access

Checklists, notes, custom items, and contacts are saved on the device (IndexedDB) after the customer chooses **Prepare for offline use** on Home, and refreshed each time the app loads online. Edits made offline are queued and sync when the connection returns; the app shows **Available offline**, **Changes waiting to sync**, or **Synced**. Failed syncs are shown with a Try again button, never dropped.

Offline access follows the paid-through date: full use until then, then 3 days read-only, then locked until the customer reconnects and renews. Saved data is never deleted. Signing out asks before removing this device's saved copy if changes are still waiting to sync.

## Public pages

- `/install` explains how to install the app on each platform (there is no App Store or Google Play app), with a QR code for safetypreplist.com/install.
- `/demo` is a public sample: 10 items from the 5-Minute Grab-and-Go Bag in `src/lib/sampleChecklist.ts`. It runs entirely in the browser, saves nothing, and never touches an account. The build fails if any other paid checklist text ends up in the public bundle (`scripts/check-bundle.mjs`).
