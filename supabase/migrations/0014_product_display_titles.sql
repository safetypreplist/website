-- Display titles only. Keep slugs grab-go and ready-bag unchanged.

update public.checklist_systems
set title = 'Grab & Go Bag'
where slug = 'grab-go' and title is distinct from 'Grab & Go Bag';

update public.checklist_systems
set title = 'Ready Duffel'
where slug = 'ready-bag' and title is distinct from 'Ready Duffel';
