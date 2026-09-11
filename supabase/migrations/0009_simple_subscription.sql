-- Simple per-person subscription. No customer-facing checklist/setup fee.
-- Existing core/full customers remain grandfathered (see 0008).
-- Product rows for the enum values added in 0008.

insert into public.products (slug, name, description, amount_cents, currency, kind, grants_plan, device_slots, active)
values
  (
    'access_monthly',
    'Monthly Access',
    'Safety Prep List access billed monthly per personal checklist.',
    499,
    'USD',
    'access_monthly',
    null,
    0,
    true
  ),
  (
    'access_annual',
    'Annual Access',
    'Safety Prep List access billed annually per personal checklist. Equivalent to $3.99/month.',
    4788,
    'USD',
    'access_annual',
    null,
    0,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  amount_cents = excluded.amount_cents,
  kind = excluded.kind,
  active = true;

update public.products
set
  name = 'Safety Prep List',
  description = 'Personal checklist subscription. Monthly or Annual per person. Survival Vault is an optional one-time add-on.',
  amount_cents = 0
where slug = 'core';

update public.products
set
  name = 'Monthly',
  description = 'Safety Prep List billed monthly per personal checklist.',
  amount_cents = 1199,
  active = true
where slug = 'access_monthly';

update public.products
set
  name = 'Annual',
  description = 'Safety Prep List billed annually per personal checklist. Shown as $9.99/month, billed annually ($119.88/year).',
  amount_cents = 11988,
  active = true
where slug = 'access_annual';

update public.products
set
  name = 'Survival Vault',
  description = 'Optional $10 one-time add-on. Not a subscription. One purchase per family/group.',
  amount_cents = 1000,
  active = true
where slug = 'upgrade_full';
