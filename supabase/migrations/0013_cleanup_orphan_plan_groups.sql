-- Signup calls ensure_plan_group twice before a membership row exists,
-- which created an empty leftover plan group. Reuse the owner's group.

create or replace function public.ensure_plan_group(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
begin
  select g.id into v_group
  from public.plan_groups g
  join public.plan_group_members m on m.group_id = g.id
  where m.user_id = p_user_id and m.status = 'active'
  order by g.created_at
  limit 1;

  if v_group is not null then
    return v_group;
  end if;

  select g.id into v_group
  from public.plan_groups g
  where g.created_by = p_user_id
  order by g.created_at
  limit 1;

  if v_group is not null then
    return v_group;
  end if;

  insert into public.plan_groups (created_by, has_shared_household)
  select p_user_id, (plan = 'full')
  from public.profiles
  where id = p_user_id
  returning id into v_group;

  return v_group;
end;
$$;

-- Ghost checklist left behind when the persistence test user was deleted
-- (owner_user_id ON DELETE SET NULL).
delete from public.personal_checklists
where owner_user_id is null
  and purchased_by_user_id is null;

-- Empty plan groups with no members.
delete from public.plan_groups g
where not exists (
  select 1 from public.plan_group_members m where m.group_id = g.id
);

-- First sandbox purchase stayed unclaimed after signup used the second Product ID.
-- Attach it so that code cannot be reused. Do not re-run entitlements.
update public.purchases p
set user_id = pr.id
from public.profiles pr
where p.product_code = 'RDM-RHRD-6WG7'
  and p.user_id is null
  and p.payment_status = 'completed'
  and pr.plan in ('core', 'full')
  and (
    select count(*) from public.profiles where plan in ('core', 'full')
  ) = 1;
