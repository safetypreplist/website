# Content management

Checklist progress is stored against `checklist_items.permanent_key` via the item UUID. You can change `text` and `description` at any time. **Do not change `permanent_key`** for an existing item.

## Option A — Owner tools in the app

1. Sign in with your account
2. In SQL:

```sql
update public.profiles
set role = 'owner'
where email = 'you@yourdomain.com';
```

3. Open `/admin`

You can edit item wording (first 80 rows), add Video Vault rows, and add verified safety resources.

## Option B — Supabase Table Editor (recommended for bulk work)

Tables:

| Table | Purpose |
|---|---|
| `checklist_systems` | Grab & Go Bag, Ready Duffel, advanced systems, `access_tier`, `sort_order`, `active` |
| `checklist_sections` | Categories inside a system |
| `checklist_items` | `permanent_key`, wording, `sort_order`, `active` |
| `video_resources` | Vault titles, URLs, thumbnails, `active` |
| `safety_contacts` | National and state records; include `source_url` and `verified_at` |
| `products` | Amounts in cents |
| `app_config` | Upgrade pricing JSON |

To add a new Full System list later: insert a `checklist_systems` row with `access_tier = 'full'`, then sections and items with new keys. The dashboard renders systems from the database — no frontend redesign.

## Safety directory policy

Do not invent phone numbers. Seed data includes:

- National numbers published by Ready.gov, SAMHSA/988, Poison.org, and FEMA (with source URLs and `verified_at`)
- Official state emergency-management **websites** from the USA.gov / FEMA directory
- National poison (1-800-222-1222), 988, FEMA, and weather.gov repeated per state as verified national services

Add a state-specific phone only after you confirm it on that agency’s current public page. Record `source_url` and today’s `verified_at`.

## Video Vault

Rows in `video_resources` with `active = false` or a blank `video_url` stay hidden. Paste a URL, set `active = true`, and the vault updates without a rebuild.

## Devices

Customers get 2 slots. They can rename or remove a registration. Browsers can be reset, so removal is the recovery path — enforcement is intentionally reasonable, not invasive. The raw device token never leaves the device; only a SHA-256 hash is stored.
