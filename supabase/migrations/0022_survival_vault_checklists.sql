-- Survival Vault owns these five checklists. Safety Prep List keeps the four timed lists.

update public.checklist_systems
set
  title = 'Off-Grid Systems',
  description = 'Stay capable when the grid is down. Low tech tools, sanitation, alternative cooking, and manual household systems for days without utilities.',
  time_label = 'FULL',
  access_tier = 'full',
  sort_order = 50
where slug = 'off-grid';

update public.checklist_systems
set
  title = 'Water Purification',
  description = 'Store, filter, and treat what you drink. Storage, filtration, purification, rotation, and emergency collection beyond the bottles in the pantry.',
  time_label = 'FULL',
  access_tier = 'full',
  sort_order = 60
where slug = 'water-purification';

update public.checklist_systems
set
  title = 'Home Battery & Solar',
  description = 'Keep essential loads running. Plan battery capacity, solar input, safe charging, and which devices actually matter overnight.',
  time_label = 'FULL',
  access_tier = 'full',
  sort_order = 70
where slug = 'battery-solar';

update public.checklist_systems
set
  title = 'Emergency Cooling / Heat Resilience',
  description = 'Stay safe in extreme temperatures. Blackout cooling, shaded rooms, hydration, and safe warmth when HVAC is not an option.',
  time_label = 'FULL',
  access_tier = 'full',
  sort_order = 80
where slug = 'cooling-heat';

update public.checklist_systems
set
  title = 'Long-Term Food',
  description = 'A pantry built for weeks, not a weekend. Staples, rotation, preservation, and manual food prep for the stretch after the first few days.',
  time_label = 'FULL',
  access_tier = 'full',
  sort_order = 90
where slug = 'long-term-food';
