-- Checklist library reads follow the access policy: full use until access_ends_at,
-- then 3 days read-only, then locked. Nothing is deleted; renewing reopens access.

create or replace function public.library_access_open(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.personal_checklists
    where owner_user_id = p_user
      and status = 'active'
      and access_ends_at is not null
      and access_ends_at + interval '3 days' < now()
  );
$$;

revoke all on function public.library_access_open(uuid) from public, anon, authenticated;

create or replace function public.can_read_catalog_section(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner() or exists (
    select 1
    from public.checklist_sections sec
    join public.checklist_systems s on s.id = sec.system_id
    join public.profiles p on p.id = auth.uid()
    where sec.id = p_section_id
      and s.active
      and p.plan <> 'none'
      and public.library_access_open(auth.uid())
      and (s.access_tier = 'core' or public.user_has_vault(auth.uid()))
  );
$$;
