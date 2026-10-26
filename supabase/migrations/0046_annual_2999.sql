-- Public pricing: $29.99/year per Personal Checklist. No new monthly offers.
-- Existing monthly Stripe/PayPal subscriptions keep their old price until they change plans.

update public.products
  set amount_cents = 2999,
      description = 'Safety Prep List billed once a year per personal checklist ($29.99/year).'
  where slug = 'access_annual';

update public.products
  set description = 'Legacy monthly billing. Not offered for new purchases.'
  where slug = 'access_monthly';

-- Retire the launch promo; annual flat pricing replaces first-month offers.
update public.discount_codes
  set active = false,
      updated_at = now()
  where code = 'LAUNCH26';
