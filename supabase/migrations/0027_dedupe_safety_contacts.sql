-- Removes safety contacts that were seeded twice and prevents the same agency from being stored twice per state and category.

begin;

delete from public.safety_contacts sc
using (
  select id,
         row_number() over (
           partition by coalesce(state, ''), category, agency_name
           order by active desc, sort_order, id
         ) as rn
  from public.safety_contacts
) d
where sc.id = d.id and d.rn > 1;

create unique index if not exists safety_contacts_unique_agency
  on public.safety_contacts ((coalesce(state, '')), category, agency_name);

commit;
