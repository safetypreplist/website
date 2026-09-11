-- Break RLS cycles that made checklist_progress / family tables return
-- "infinite recursion detected in policy" and wiped saved checks on reload.

create or replace function public.is_plan_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.plan_group_members
    where group_id = p_group_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;

create or replace function public.checklist_in_viewer_group(p_checklist_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.plan_group_members mine
    join public.plan_group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = p_user_id
      and mine.status = 'active'
      and theirs.checklist_id = p_checklist_id
  );
$$;

create or replace function public.has_checklist_grant(p_checklist_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.checklist_permissions
    where checklist_id = p_checklist_id
      and grantee_user_id = p_user_id
      and revoked_at is null
  );
$$;

create or replace function public.owns_personal_checklist(p_checklist_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.personal_checklists
    where id = p_checklist_id
      and owner_user_id = p_user_id
  );
$$;

create or replace function public.is_household_progress_row(p_owner uuid, p_item_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.plan_groups g
    join public.plan_group_members me on me.group_id = g.id
    join public.checklist_items i on i.id = p_item_id
    join public.checklist_sections s on s.id = i.section_id
    join public.checklist_systems sys on sys.id = s.system_id
    where g.has_shared_household
      and g.created_by = p_owner
      and me.user_id = p_user_id
      and me.status = 'active'
      and sys.access_tier = 'full'
  );
$$;

grant execute on function public.is_plan_group_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.checklist_in_viewer_group(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_checklist_grant(uuid, uuid) to authenticated, service_role;
grant execute on function public.owns_personal_checklist(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_household_progress_row(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists plan_group_members_select on public.plan_group_members;
create policy plan_group_members_select on public.plan_group_members
  for select using (
    user_id = auth.uid()
    or public.is_plan_group_member(group_id)
  );

drop policy if exists plan_groups_select on public.plan_groups;
create policy plan_groups_select on public.plan_groups
  for select using (
    created_by = auth.uid()
    or public.is_plan_group_member(id)
  );

drop policy if exists personal_checklists_select on public.personal_checklists;
create policy personal_checklists_select on public.personal_checklists
  for select using (
    owner_user_id = auth.uid()
    or purchased_by_user_id = auth.uid()
    or public.has_checklist_grant(id)
    or public.checklist_in_viewer_group(id)
  );

drop policy if exists checklist_permissions_select on public.checklist_permissions;
create policy checklist_permissions_select on public.checklist_permissions
  for select using (
    grantee_user_id = auth.uid()
    or public.owns_personal_checklist(checklist_id)
  );

drop policy if exists household_progress_select on public.checklist_progress;
create policy household_progress_select on public.checklist_progress
  for select using (
    public.is_household_progress_row(user_id, checklist_item_id)
  );
