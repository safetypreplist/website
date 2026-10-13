-- Everyone on a family plan chooses, per person, whether that person can view
-- or edit their checklist. A choice made before the other person has an
-- account is kept against that person's seat and becomes a real
-- checklist_permissions row once the seat is claimed.

create table if not exists public.checklist_seat_grants (
  checklist_id uuid not null references public.personal_checklists (id) on delete cascade,
  grantee_checklist_id uuid not null references public.personal_checklists (id) on delete cascade,
  permission text not null check (permission in ('view', 'edit')),
  updated_at timestamptz not null default now(),
  primary key (checklist_id, grantee_checklist_id),
  check (checklist_id <> grantee_checklist_id)
);

alter table public.checklist_seat_grants enable row level security;

drop policy if exists checklist_seat_grants_select on public.checklist_seat_grants;
create policy checklist_seat_grants_select on public.checklist_seat_grants
  for select using (public.owns_personal_checklist(checklist_id));

grant select on public.checklist_seat_grants to authenticated;

create or replace function public.same_family_plan(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plan_group_members a
    join public.plan_group_members b on b.group_id = a.group_id
    where a.checklist_id = p_a
      and b.checklist_id = p_b
  );
$$;

revoke all on function public.same_family_plan(uuid, uuid) from public, anon, authenticated;

create or replace function public.sync_seat_grants(p_checklist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ready as (
    select g.checklist_id, g.grantee_checklist_id, g.permission, gc.owner_user_id as grantee
    from public.checklist_seat_grants g
    join public.personal_checklists c
      on c.id = g.checklist_id and c.status = 'active' and c.owner_user_id is not null
    join public.personal_checklists gc
      on gc.id = g.grantee_checklist_id and gc.status = 'active' and gc.owner_user_id is not null
    where (g.checklist_id = p_checklist_id or g.grantee_checklist_id = p_checklist_id)
      and gc.owner_user_id <> c.owner_user_id
  ),
  applied as (
    insert into public.checklist_permissions (checklist_id, grantee_user_id, permission, updated_at, revoked_at)
    select checklist_id, grantee, permission, now(), null from ready
    on conflict (checklist_id, grantee_user_id)
    do update set permission = excluded.permission, updated_at = now(), revoked_at = null
    returning 1
  )
  delete from public.checklist_seat_grants g
  using ready r
  where g.checklist_id = r.checklist_id
    and g.grantee_checklist_id = r.grantee_checklist_id;
end;
$$;

revoke all on function public.sync_seat_grants(uuid) from public, anon, authenticated;

-- p_grants: [{ "checklistId": uuid, "permission": "view" | "edit" }]
-- Grants access to p_user_id's own checklist for each listed family checklist.
create or replace function public.save_family_grants(p_user_id uuid, p_grants jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mine uuid;
  v_item jsonb;
  v_target uuid;
  v_perm text;
  v_owner uuid;
  v_status text;
  v_count integer := 0;
begin
  if p_user_id is null or p_grants is null or jsonb_typeof(p_grants) <> 'array' then
    return 0;
  end if;

  select id into v_mine
  from public.personal_checklists
  where owner_user_id = p_user_id and status = 'active'
  order by created_at
  limit 1;
  if v_mine is null then
    return 0;
  end if;

  for v_item in select value from jsonb_array_elements(p_grants) loop
    v_target := null;
    begin
      v_target := nullif(v_item->>'checklistId', '')::uuid;
    exception when others then
      v_target := null;
    end;
    v_perm := coalesce(v_item->>'permission', '');
    if v_target is null or v_target = v_mine or v_perm not in ('view', 'edit') then
      continue;
    end if;
    if not public.same_family_plan(v_mine, v_target) then
      continue;
    end if;

    select owner_user_id, status into v_owner, v_status
    from public.personal_checklists
    where id = v_target;
    if v_status is null or v_status not in ('active', 'pending_claim') then
      continue;
    end if;

    if v_owner is not null then
      if v_owner = p_user_id then
        continue;
      end if;
      insert into public.checklist_permissions (checklist_id, grantee_user_id, permission, updated_at, revoked_at)
      values (v_mine, v_owner, v_perm, now(), null)
      on conflict (checklist_id, grantee_user_id)
      do update set permission = excluded.permission, updated_at = now(), revoked_at = null;
      delete from public.checklist_seat_grants
      where checklist_id = v_mine and grantee_checklist_id = v_target;
    else
      insert into public.checklist_seat_grants (checklist_id, grantee_checklist_id, permission, updated_at)
      values (v_mine, v_target, v_perm, now())
      on conflict (checklist_id, grantee_checklist_id)
      do update set permission = excluded.permission, updated_at = now();
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.save_family_grants(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_family_grants(uuid, jsonb) to service_role;

create or replace function public.set_family_permissions(p_grants jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  return public.save_family_grants(auth.uid(), p_grants);
end;
$$;

revoke all on function public.set_family_permissions(jsonb) from public, anon;
grant execute on function public.set_family_permissions(jsonb) to authenticated;

-- Other people on the plan, shown on the invite page so the new member can
-- choose what each of them may do with their checklist.
create or replace function public.family_invite_members(p_token text)
returns table (checklist_id uuid, name text, is_primary boolean, has_account boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    coalesce(
      nullif(btrim(concat_ws(' ', coalesce(c.invited_first_name, p.first_name), coalesce(c.invited_last_name, p.last_name))), ''),
      p.display_name,
      'Family member'
    ),
    m.role = 'owner',
    c.owner_user_id is not null
  from public.checklist_invitations i
  join public.plan_group_members mine on mine.checklist_id = i.checklist_id
  join public.plan_group_members m on m.group_id = mine.group_id and m.checklist_id <> i.checklist_id
  join public.personal_checklists c on c.id = m.checklist_id and c.status in ('active', 'pending_claim')
  left join public.profiles p on p.id = c.owner_user_id
  where i.token_hash = public.invite_token_hash(p_token)
    and i.status = 'pending'
    and i.expires_at > now()
    and (c.owner_user_id is not null or c.invited_email is not null)
  order by (m.role = 'owner') desc, c.created_at;
$$;

grant execute on function public.family_invite_members(text) to anon, authenticated;

create or replace function public.claim_family_seat(p_user_id uuid, p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.checklist_invitations%rowtype;
  v_seat public.personal_checklists%rowtype;
  v_plan public.plan_tier;
begin
  if p_user_id is null or coalesce(btrim(p_token), '') = '' then
    return null;
  end if;

  select * into v_inv
  from public.checklist_invitations
  where token_hash = public.invite_token_hash(p_token)
    and status = 'pending'
    and expires_at > now()
  for update;
  if v_inv.id is null then
    return null;
  end if;

  if exists (
    select 1 from public.personal_checklists
    where owner_user_id = p_user_id and status = 'active'
  ) then
    return null;
  end if;

  select * into v_seat
  from public.personal_checklists
  where id = v_inv.checklist_id
    and status = 'pending_claim'
    and owner_user_id is null
  for update;
  if v_seat.id is null then
    return null;
  end if;

  update public.personal_checklists
  set owner_user_id = p_user_id, status = 'active'
  where id = v_seat.id;

  update public.plan_group_members
  set user_id = p_user_id, status = 'active', joined_at = now()
  where checklist_id = v_seat.id;
  if not found and v_inv.group_id is not null then
    insert into public.plan_group_members (group_id, checklist_id, user_id, role, status)
    values (v_inv.group_id, v_seat.id, p_user_id, 'member', 'active')
    on conflict (group_id, checklist_id) do update set user_id = excluded.user_id, status = 'active';
  end if;

  select case when p.plan = 'full'::public.plan_tier then 'full'::public.plan_tier else 'core'::public.plan_tier end
  into v_plan
  from public.profiles p
  where p.id = v_seat.purchased_by_user_id;

  update public.profiles
  set plan = case when plan = 'full'::public.plan_tier then plan else coalesce(v_plan, 'core'::public.plan_tier) end,
      device_limit = greatest(device_limit, 2)
  where id = p_user_id;

  insert into public.account_entitlements (user_id, entitlement)
  select p_user_id, 'core'
  where not exists (
    select 1 from public.account_entitlements where user_id = p_user_id and entitlement = 'core'
  );

  update public.checklist_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_inv.id;

  perform public.sync_seat_grants(v_seat.id);

  return v_seat.id;
end;
$$;

revoke all on function public.claim_family_seat(uuid, text) from public, anon, authenticated;

drop function if exists public.accept_family_invite(text);

create or replace function public.accept_family_invite(p_token text, p_grants jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  v_id := public.claim_family_seat(auth.uid(), p_token);
  if v_id is null then
    raise exception 'INVITE_UNAVAILABLE';
  end if;
  perform public.save_family_grants(auth.uid(), p_grants);
  return v_id;
end;
$$;

revoke all on function public.accept_family_invite(text, jsonb) from public, anon;
grant execute on function public.accept_family_invite(text, jsonb) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_purchase public.purchases%rowtype;
  v_plan public.plan_tier := 'none';
  v_full_name text;
  v_first text;
  v_last text;
  v_seat uuid;
begin
  v_code := nullif(trim(coalesce(new.raw_user_meta_data->>'product_code', '')), '');
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  v_first := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', split_part(coalesce(v_full_name, ''), ' ', 1))), '');
  v_last := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');
  if v_last is null and v_full_name is not null then
    v_last := nullif(btrim(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 1)), '');
  end if;

  if v_code is not null then
    select * into v_purchase
    from public.purchases
    where product_code = v_code
      and payment_status = 'completed'
      and user_id is null
    for update;
  end if;

  if v_purchase.id is null and new.email is not null then
    select * into v_purchase
    from public.purchases
    where id = (
      select p.id
      from public.purchases p
      where p.payment_status = 'completed'
        and p.user_id is null
        and p.payer_email is not null
        and lower(p.payer_email) = lower(new.email)
      order by p.created_at desc
      limit 1
    )
    for update;
  end if;

  if v_purchase.id is not null then
    if v_purchase.product_type in ('core') then
      v_plan := case when v_purchase.includes_household then 'full' else 'core' end;
    elsif v_purchase.product_type in ('full', 'upgrade_full') then
      v_plan := 'full';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, first_name, last_name, display_name, plan, device_limit)
  values (
    new.id,
    new.email,
    v_full_name,
    v_first,
    v_last,
    v_full_name,
    v_plan,
    case when v_plan = 'none' then 0 else 2 end
  );

  if v_purchase.id is not null then
    update public.purchases set user_id = new.id where id = v_purchase.id;
    perform public.apply_purchase_entitlements(v_purchase.id);
  else
    v_seat := public.claim_family_seat(new.id, new.raw_user_meta_data->>'invite_token');
    if v_seat is not null then
      perform public.save_family_grants(new.id, new.raw_user_meta_data->'family_permissions');
    end if;
  end if;

  return new;
end;
$$;
