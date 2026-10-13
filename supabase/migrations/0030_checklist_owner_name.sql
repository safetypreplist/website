-- A checklist bought before the account existed has no name on it, so family
-- views fell back to "Family member". Copy the owner's profile name onto the
-- checklist whenever an owner is attached and no name is set.

create or replace function public.fill_checklist_owner_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is not null
     and coalesce(new.invited_first_name, '') = ''
     and coalesce(new.invited_last_name, '') = '' then
    select nullif(btrim(p.first_name), ''), nullif(btrim(p.last_name), '')
      into new.invited_first_name, new.invited_last_name
    from public.profiles p
    where p.id = new.owner_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists personal_checklists_owner_name on public.personal_checklists;
create trigger personal_checklists_owner_name
  before insert or update of owner_user_id on public.personal_checklists
  for each row execute function public.fill_checklist_owner_name();

update public.personal_checklists c
set invited_first_name = nullif(btrim(p.first_name), ''),
    invited_last_name = nullif(btrim(p.last_name), '')
from public.profiles p
where p.id = c.owner_user_id
  and coalesce(c.invited_first_name, '') = ''
  and coalesce(c.invited_last_name, '') = '';
