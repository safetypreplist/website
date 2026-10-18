-- Drop How-To Videos from Survival Vault product copy. The playlist feature was removed from the app.
update public.products
set description = 'Unlock Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, and Long-Term Food. $10 one time, not $10 per person. Does not renew.'
where slug = 'upgrade_full'
  and description ilike '%How-To Videos%';
