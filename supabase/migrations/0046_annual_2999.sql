-- Public pricing: $30/year per Personal Checklist. Survival Vault $10/year add-on.
-- Existing monthly Stripe/PayPal subscriptions keep their old price until they change plans.

update public.products
  set amount_cents = 3000,
      description = 'Safety Prep List billed once a year per personal checklist ($30/year).',
      updated_at = now()
  where slug = 'access_annual';

update public.products
  set description = 'Legacy monthly billing. Not offered for new purchases.',
      updated_at = now()
  where slug = 'access_monthly';

update public.products
  set amount_cents = 1000,
      description = 'Survival Vault yearly add-on ($10/year). Not per person.',
      updated_at = now()
  where slug = 'upgrade_full';

-- Retire the launch promo; annual flat pricing replaces first-month offers.
update public.discount_codes
  set active = false,
      updated_at = now()
  where code = 'LAUNCH26';
