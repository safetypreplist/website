# Supabase setup

## 1. Create the project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. New project → wait for the database to finish provisioning
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key stays in the dashboard only. Edge Functions receive it automatically as `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Apply schema

In the SQL editor, run in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/seed.sql`

Or from the CLI (after `supabase login` and `supabase link`):

```bash
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

`0001_init.sql` creates tables, RLS, triggers, and RPCs. `seed.sql` loads checklist systems, national safety records, state emergency-management **websites**, and Video Vault placeholders.

Re-generate seed data after catalog edits:

```bash
python3 scripts/generate_seed.py
```

Item identifiers are `permanent_key` values (`ready.documents.passport`). Never use visible wording as the ID.

## 3. Auth settings

Authentication → Providers → Email:

- Enable Email
- For the intended **Pay → Create Account → Enter** flow, turn **off** “Confirm email” in development, or keep it on and use the confirmation email (the app handles both).
- Add your site to **Redirect URLs**:
  - `http://localhost:5173/**`
  - `https://YOURDOMAIN.com/**`

Templates can mention Safety Prep List.

## 4. Row Level Security

RLS is enabled on every customer table.

Customers may only read/write:

- their profile (cannot change `plan`, `device_limit`, or `role` from the client)
- their progress, notes, contacts, and devices
- their purchases and entitlements

Public catalog tables are readable: checklist definitions, products, `app_config`, published safety contacts, published videos.

Owner writes go through `profiles.role = 'owner'`. Promote yourself after signup:

```sql
update public.profiles
set role = 'owner'
where email = 'you@yourdomain.com';
```

## 5. Edge Functions

From this repo:

```bash
supabase functions deploy create-paypal-order
supabase functions deploy capture-paypal-order
supabase functions deploy purchase-device-slot
supabase functions deploy upgrade-plan
supabase functions deploy subscribe-checklist
```

Then set secrets (see `supabase/functions/.env.example`):

```bash
supabase secrets set PAYPAL_CLIENT_ID=...
supabase secrets set PAYPAL_CLIENT_SECRET=...
supabase secrets set PAYPAL_ENV=live
supabase secrets set RESEND_API_KEY=...
supabase secrets set EMAIL_FROM="Safety Prep List <noreply@yourdomain.com>"
supabase secrets set APP_URL=https://yourdomain.com
supabase secrets set SUPPORT_EMAIL=support@yourdomain.com
supabase secrets set BREVO_API_KEY=...
supabase secrets set BREVO_LIST_ID=...
```

## 6. Realtime

The migration adds `checklist_progress`, `contacts`, `devices`, and `profiles` to `supabase_realtime`. Confirm Database → Replication if a table is missing.

## 7. Storage

This app does **not** use file or photo uploads. Do not open public storage buckets for customer content.
