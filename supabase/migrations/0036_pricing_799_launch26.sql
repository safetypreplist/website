-- New prices for new subscriptions: $7.99/month or $79.99/year per Personal Checklist.
-- Existing PayPal subscriptions stay on the plan (and price) they were created with.
update public.products
  set amount_cents = 799,
      description = 'Safety Prep List billed monthly per personal checklist.'
  where slug = 'access_monthly';

update public.products
  set amount_cents = 7999,
      description = 'Safety Prep List billed annually per personal checklist ($79.99/year, about $6.67/month).'
  where slug = 'access_annual';

-- Codes can be limited to Monthly or Annual billing.
alter table public.discount_codes
  add column if not exists applies_to_interval text not null default 'all';

alter table public.discount_codes drop constraint if exists discount_codes_applies_to_interval_check;
alter table public.discount_codes
  add constraint discount_codes_applies_to_interval_check check (applies_to_interval in ('all', 'monthly', 'annual'));

comment on column public.discount_codes.applies_to_interval is 'Billing the code works with: all, monthly, or annual.';

-- LAUNCH26: first month $4.99 per Personal Checklist on Monthly billing, then the regular monthly price.
update public.discount_codes
  set kind = 'price',
      value = 499,
      applies_to = 'all',
      applies_to_interval = 'monthly',
      discount_payments = 1,
      updated_at = now()
  where code = 'LAUNCH26';
