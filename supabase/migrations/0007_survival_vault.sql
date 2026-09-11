-- Relabel the optional advanced add-on as Survival Vault.
-- Existing entitlements are unchanged:
--   profiles.plan = 'full'
--   plan_groups.has_shared_household = true
--   purchases.includes_household = true
--   product slugs 'full' and 'upgrade_full'
-- Anyone who already has that access keeps Survival Vault without repurchasing.

update public.products
set
  name = 'Survival Vault',
  description = 'Optional $10 one-time add-on: off-grid systems, water purification, backup battery and solar, emergency heating and cooling, long-term food, How-To Videos, and other advanced preparedness resources.'
where slug = 'upgrade_full';

update public.products
set
  name = 'Survival Vault',
  description = 'Legacy Full System bundle. Existing access maps to Survival Vault. New purchases add Survival Vault as an optional $10 add-on.'
where slug = 'full';
