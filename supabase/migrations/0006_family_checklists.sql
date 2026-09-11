-- Personal checklists, Family Plan groups, permissions, invitations,
-- Shared Household List entitlement, $10 personal pricing, 5 custom items,
-- and a hard 2-device policy for new purchases.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Products / pricing
-- ---------------------------------------------------------------------------

update public.products
set
  name = 'Personal Safety Prep Checklist',
  description = 'One personal Safety Prep Checklist, lifetime access, and sign-in on up to 2 devices.',
  amount_cents = 1000,
  active = true
where slug = 'core';

update public.products
set
  name = 'Shared Household List',
  description = 'Legacy Full System bundle. New purchases add Shared Household List as an optional upgrade.',
  active = false
where slug = 'full';

update public.products
set
  name = 'Shared Household List',
  description = 'Optional advanced household preparedness: water, power, off-grid, food, heating/cooling, and Video Vault.',
  amount_cents = 1000,
  active = true
where slug = 'upgrade_full';

update public.products
set
  description = 'Legacy device slot. New accounts include 2 devices and cannot purchase more.',
  active = false
where slug = 'extra_device';

update public.products
set
  description = 'Legacy custom-item pack. New checklists include 5 custom items per section.',
  active = false
where slug = 'extra_items';

update public.app_config
set value = jsonb_set(jsonb_set(value, '{core,amount_cents}', '1000'), '{core,slug}', '"core"')
where key = 'pricing';

-- ---------------------------------------------------------------------------
-- Profile name fields
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists display_name text;

update public.profiles
set
  first_name = coalesce(first_name, nullif(split_part(trim(coalesce(full_name, '')), ' ', 1), '')),
  last_name = coalesce(
    last_name,
    nullif(btrim(substr(trim(coalesce(full_name, '')), length(split_part(trim(coalesce(full_name, '')), ' ', 1)) + 1)), '')
  )
where full_name is not null and first_name is null;

-- ---------------------------------------------------------------------------
-- Purchase metadata for family quantity / household add-on
-- ---------------------------------------------------------------------------

alter table public.purchases
  add column if not exists quantity integer not null default 1 check (quantity >= 1),
  add column if not exists includes_household boolean not null default false;

-- ---------------------------------------------------------------------------
-- Personal checklists + family groups
-- ---------------------------------------------------------------------------

create table if not exists public.personal_checklists (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  owner_user_id uuid references public.profiles (id) on delete set null,
  purchased_by_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'pending_claim', 'cancelled')),
  invited_first_name text,
  invited_last_name text,
  invited_email text,
  created_at timestamptz not null default now()
);

create index if not exists personal_checklists_owner_idx on public.personal_checklists (owner_user_id);
create unique index if not exists personal_checklists_one_active_owner
  on public.personal_checklists (owner_user_id)
  where owner_user_id is not null and status = 'active';

create table if not exists public.plan_groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  has_shared_household boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.plan_groups (id) on delete cascade,
  checklist_id uuid not null references public.personal_checklists (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'pending')),
  joined_at timestamptz not null default now(),
  unique (group_id, checklist_id)
);

create table if not exists public.checklist_permissions (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.personal_checklists (id) on delete cascade,
  grantee_user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null check (permission in ('view', 'edit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (checklist_id, grantee_user_id)
);

create table if not exists public.checklist_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.plan_groups (id) on delete cascade,
  checklist_id uuid references public.personal_checklists (id) on delete cascade,
  invited_email text not null,
  invited_name text,
  token_hash text not null unique,
  invited_by_user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'purchase' check (kind in ('purchase', 'connect')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists checklist_invitations_email_idx on public.checklist_invitations (lower(invited_email));

-- ---------------------------------------------------------------------------
-- ID generation + access helpers
-- ---------------------------------------------------------------------------

create or replace function public.generate_public_checklist_id()
returns text
language plpgsql
as $$
declare
  candidate text;
  i integer;
begin
  for i in 1..24 loop
    candidate := 'SPL-' || lpad(floor(random() * 1000000)::int::text, 6, '0');
    if not exists (select 1 from public.personal_checklists where public_id = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Could not generate checklist id';
end;
$$;

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

  insert into public.plan_groups (created_by, has_shared_household)
  select p_user_id, (plan = 'full')
  from public.profiles
  where id = p_user_id
  returning id into v_group;

  return v_group;
end;
$$;

create or replace function public.ensure_personal_checklist(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_group uuid;
begin
  select id into v_id
  from public.personal_checklists
  where owner_user_id = p_user_id and status = 'active'
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.personal_checklists (public_id, owner_user_id, purchased_by_user_id, status)
  values (public.generate_public_checklist_id(), p_user_id, p_user_id, 'active')
  returning id into v_id;

  v_group := public.ensure_plan_group(p_user_id);

  insert into public.plan_group_members (group_id, checklist_id, user_id, role, status)
  values (v_group, v_id, p_user_id, 'owner', 'active')
  on conflict (group_id, checklist_id) do nothing;

  return v_id;
end;
$$;

create or replace function public.checklist_permission_for(p_checklist_id uuid, p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_perm text;
begin
  if p_user_id is null then
    return null;
  end if;

  select owner_user_id into v_owner
  from public.personal_checklists
  where id = p_checklist_id and status = 'active';

  if v_owner is not null and v_owner = p_user_id then
    return 'own';
  end if;

  select permission into v_perm
  from public.checklist_permissions
  where checklist_id = p_checklist_id
    and grantee_user_id = p_user_id
    and revoked_at is null;

  return v_perm;
end;
$$;

create or replace function public.can_read_owner_progress(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or exists (
      select 1
      from public.personal_checklists c
      join public.checklist_permissions p on p.checklist_id = c.id
      where c.owner_user_id = p_owner_id
        and c.status = 'active'
        and p.grantee_user_id = auth.uid()
        and p.revoked_at is null
    );
$$;

-- ---------------------------------------------------------------------------
-- Backfill existing entitled profiles
-- ---------------------------------------------------------------------------

insert into public.personal_checklists (public_id, owner_user_id, purchased_by_user_id, status)
select public.generate_public_checklist_id(), p.id, p.id, 'active'
from public.profiles p
where p.plan in ('core', 'full')
  and not exists (
    select 1 from public.personal_checklists c
    where c.owner_user_id = p.id and c.status = 'active'
  );

insert into public.plan_groups (created_by, has_shared_household)
select p.id, (p.plan = 'full')
from public.profiles p
where p.plan in ('core', 'full')
  and not exists (
    select 1
    from public.plan_group_members m
    where m.user_id = p.id and m.status = 'active'
  );

insert into public.plan_group_members (group_id, checklist_id, user_id, role, status)
select g.id, c.id, p.id, 'owner', 'active'
from public.profiles p
join public.personal_checklists c on c.owner_user_id = p.id and c.status = 'active'
join public.plan_groups g on g.created_by = p.id
where p.plan in ('core', 'full')
on conflict (group_id, checklist_id) do nothing;

update public.plan_groups g
set has_shared_household = true
from public.profiles p
where g.created_by = p.id and p.plan = 'full';

-- ---------------------------------------------------------------------------
-- Custom item cap: 5 going forward. Existing rows are kept.
-- ---------------------------------------------------------------------------

create or replace function public.custom_item_cap(p_bonus integer)
returns integer
language sql
immutable
as $$
  select 5;
$$;

drop function if exists public.add_custom_item(uuid, text, text);

create or replace function public.add_custom_item(
  p_section_id uuid,
  p_text text,
  p_description text default null,
  p_owner_user_id uuid default null
)
returns public.custom_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_count integer;
  v_sort integer;
  v_result public.custom_checklist_items;
  v_text text := left(trim(coalesce(p_text, '')), 120);
  v_desc text := nullif(left(trim(coalesce(p_description, '')), 280), '');
  v_perm text;
  v_checklist uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if v_text = '' then
    raise exception 'Item text is required';
  end if;
  if not exists (select 1 from public.checklist_sections where id = p_section_id) then
    raise exception 'Unknown section';
  end if;

  v_owner := coalesce(p_owner_user_id, v_actor);
  select id into v_checklist
  from public.personal_checklists
  where owner_user_id = v_owner and status = 'active'
  limit 1;

  if v_owner <> v_actor then
    v_perm := public.checklist_permission_for(v_checklist, v_actor);
    if v_perm is distinct from 'edit' then
      raise exception 'CHECKLIST_VIEW_ONLY';
    end if;
  end if;

  select count(*) into v_count
  from public.custom_checklist_items
  where user_id = v_owner and section_id = p_section_id;

  if v_count >= 5 then
    raise exception 'ITEM_LIMIT_REACHED';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.custom_checklist_items
  where user_id = v_owner and section_id = p_section_id;

  insert into public.custom_checklist_items (user_id, section_id, text, description, sort_order)
  values (v_owner, p_section_id, v_text, v_desc, v_sort)
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.save_custom_item_progress(
  p_item_id uuid,
  p_checked boolean,
  p_note text
)
returns public.custom_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_result public.custom_checklist_items;
  v_owner uuid;
  v_checklist uuid;
  v_perm text;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select user_id into v_owner from public.custom_checklist_items where id = p_item_id;
  if v_owner is null then
    raise exception 'Unknown custom item';
  end if;

  if v_owner <> v_actor then
    select id into v_checklist from public.personal_checklists where owner_user_id = v_owner and status = 'active' limit 1;
    v_perm := public.checklist_permission_for(v_checklist, v_actor);
    if v_perm is distinct from 'edit' then
      raise exception 'CHECKLIST_VIEW_ONLY';
    end if;
  end if;

  update public.custom_checklist_items
    set checked = coalesce(p_checked, false),
        note = left(coalesce(p_note, ''), 100)
    where id = p_item_id
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.remove_custom_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_checklist uuid;
  v_perm text;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  select user_id into v_owner from public.custom_checklist_items where id = p_item_id;
  if v_owner is null then
    return;
  end if;
  if v_owner <> v_actor then
    select id into v_checklist from public.personal_checklists where owner_user_id = v_owner and status = 'active' limit 1;
    v_perm := public.checklist_permission_for(v_checklist, v_actor);
    if v_perm is distinct from 'edit' then
      raise exception 'CHECKLIST_VIEW_ONLY';
    end if;
  end if;
  delete from public.custom_checklist_items where id = p_item_id;
end;
$$;

drop function if exists public.upsert_progress(uuid, boolean, text, uuid);

create or replace function public.upsert_progress(
  p_item_id uuid,
  p_checked boolean,
  p_note text,
  p_device_id uuid,
  p_owner_user_id uuid default null
)
returns public.checklist_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_note text := left(coalesce(p_note, ''), 100);
  v_result public.checklist_progress;
  v_item public.checklist_items%rowtype;
  v_system public.checklist_systems%rowtype;
  v_plan public.plan_tier;
  v_perm text;
  v_checklist uuid;
  v_household boolean := false;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item from public.checklist_items where id = p_item_id;
  if not found or v_item.active is not true then
    raise exception 'Unknown checklist item';
  end if;

  select s.* into v_system
  from public.checklist_sections sec
  join public.checklist_systems s on s.id = sec.system_id
  where sec.id = v_item.section_id;

  v_owner := coalesce(p_owner_user_id, v_actor);

  select plan into v_plan from public.profiles where id = v_owner;
  if v_plan = 'none' then
    raise exception 'NO_ENTITLEMENT';
  end if;

  if v_system.access_tier = 'full' then
    select coalesce(bool_or(g.has_shared_household), false) into v_household
    from public.plan_group_members m
    join public.plan_groups g on g.id = m.group_id
    where m.user_id = v_owner and m.status = 'active';
    if v_plan <> 'full' and not v_household then
      raise exception 'FULL_SYSTEM_REQUIRED';
    end if;
    -- Shared household list is edited as the household owner's progress.
    select g.created_by into v_owner
    from public.plan_group_members m
    join public.plan_groups g on g.id = m.group_id
    where m.user_id = coalesce(p_owner_user_id, v_actor) and m.status = 'active'
    order by g.created_at
    limit 1;
    v_owner := coalesce(v_owner, coalesce(p_owner_user_id, v_actor));
    if v_actor <> v_owner and not exists (
      select 1 from public.plan_group_members m
      where m.user_id = v_actor and m.status = 'active'
        and m.group_id in (select group_id from public.plan_group_members where user_id = v_owner)
    ) then
      raise exception 'CHECKLIST_VIEW_ONLY';
    end if;
  else
    if v_owner <> v_actor then
      select id into v_checklist from public.personal_checklists where owner_user_id = v_owner and status = 'active' limit 1;
      v_perm := public.checklist_permission_for(v_checklist, v_actor);
      if v_perm is distinct from 'edit' then
        raise exception 'CHECKLIST_VIEW_ONLY';
      end if;
    end if;
  end if;

  insert into public.checklist_progress (
    user_id, checklist_item_id, checked, note, updated_by_device_id, updated_at
  ) values (
    v_owner, p_item_id, coalesce(p_checked, false), v_note, p_device_id, now()
  )
  on conflict (user_id, checklist_item_id)
  do update set
    checked = excluded.checked,
    note = excluded.note,
    updated_by_device_id = excluded.updated_by_device_id,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Provision checklists from a purchase
-- ---------------------------------------------------------------------------

create or replace function public.provision_purchase_checklists(p_user_id uuid, p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.purchases%rowtype;
  v_group uuid;
  v_qty integer := 1;
  v_i integer;
  v_id uuid;
begin
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found then
    return;
  end if;

  v_qty := greatest(coalesce(v_p.quantity, 1), 1);
  v_group := public.ensure_plan_group(p_user_id);

  if v_p.product_type in ('full', 'upgrade_full') or v_p.includes_household then
    update public.plan_groups set has_shared_household = true where id = v_group;
  end if;

  if v_p.product_type in ('core', 'full') then
    perform public.ensure_personal_checklist(p_user_id);
    -- Remaining seats are pending invitations / unclaimed checklists.
    for v_i in 2..v_qty loop
      insert into public.personal_checklists (public_id, purchased_by_user_id, status)
      values (public.generate_public_checklist_id(), p_user_id, 'pending_claim')
      returning id into v_id;
      insert into public.plan_group_members (group_id, checklist_id, role, status)
      values (v_group, v_id, 'member', 'pending');
    end loop;
  end if;
end;
$$;

create or replace function public.apply_purchase_entitlements(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.purchases%rowtype;
  v_existing boolean := false;
begin
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found or v_p.user_id is null or v_p.payment_status <> 'completed' then
    return;
  end if;

  select exists (
    select 1 from public.personal_checklists
    where owner_user_id = v_p.user_id and status = 'active'
  ) into v_existing;

  if v_p.product_type = 'core' then
    update public.profiles
      set plan = case
            when plan = 'full' or v_p.includes_household then 'full'
            else 'core'
          end,
          device_limit = greatest(device_limit, 2)
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'core', v_p.id)
    on conflict do nothing;
    if v_p.includes_household then
      insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
      values
        (v_p.user_id, 'full', v_p.id),
        (v_p.user_id, 'video_vault', v_p.id)
      on conflict do nothing;
    end if;
    if v_existing then
      -- Additional $10 personal checklist for an existing customer.
      insert into public.personal_checklists (public_id, purchased_by_user_id, status)
      values (public.generate_public_checklist_id(), v_p.user_id, 'pending_claim');
      insert into public.plan_group_members (group_id, checklist_id, role, status)
      select public.ensure_plan_group(v_p.user_id), c.id, 'member', 'pending'
      from public.personal_checklists c
      where c.purchased_by_user_id = v_p.user_id and c.status = 'pending_claim'
      order by c.created_at desc
      limit 1
      on conflict do nothing;
    else
      perform public.provision_purchase_checklists(v_p.user_id, v_p.id);
    end if;
  elsif v_p.product_type in ('full', 'upgrade_full') then
    update public.profiles
      set plan = 'full',
          device_limit = greatest(device_limit, 2)
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values
      (v_p.user_id, 'core', v_p.id),
      (v_p.user_id, 'full', v_p.id),
      (v_p.user_id, 'video_vault', v_p.id)
    on conflict do nothing;
    perform public.ensure_personal_checklist(v_p.user_id);
    update public.plan_groups
      set has_shared_household = true
      where id = public.ensure_plan_group(v_p.user_id);
    if v_p.product_type = 'full' then
      perform public.provision_purchase_checklists(v_p.user_id, v_p.id);
    end if;
  elsif v_p.product_type = 'extra_device' then
    -- Preserve previously purchased extra device slots; do not sell new ones.
    update public.profiles
      set device_limit = device_limit + 1
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'extra_device', v_p.id);
  elsif v_p.product_type = 'extra_items' then
    -- Preserve historical purchases; cap is no longer increased.
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'extra_items', v_p.id);
  end if;
end;
$$;

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

    if found then
      if v_purchase.product_type in ('core') then
        v_plan := case when v_purchase.includes_household then 'full' else 'core' end;
      elsif v_purchase.product_type in ('full', 'upgrade_full') then
        v_plan := 'full';
      end if;
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
  end if;

  return new;
end;
$$;

create or replace function public.register_device(
  p_token_hash text,
  p_nickname text,
  p_description text default null
)
returns public.devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.devices;
  v_count integer;
  v_limit integer;
  v_result public.devices;
  v_nick text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Invalid device token';
  end if;

  v_nick := left(trim(coalesce(p_nickname, '')), 40);
  if v_nick = '' then
    v_nick := 'My Device';
  end if;

  select * into v_existing
  from public.devices
  where user_id = v_user_id
    and device_token_hash = p_token_hash;

  if found then
    update public.devices
      set last_seen_at = now(),
          device_description = coalesce(nullif(p_description, ''), device_description),
          nickname = case when v_nick = 'My Device' then nickname else v_nick end
      where id = v_existing.id
      returning * into v_result;
    return v_result;
  end if;

  select device_limit into v_limit from public.profiles where id = v_user_id;
  select count(*) into v_count from public.devices where user_id = v_user_id;

  if v_count >= coalesce(v_limit, 0) then
    raise exception 'DEVICE_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Remove one of your existing devices to continue.';
  end if;

  insert into public.devices (user_id, device_token_hash, nickname, device_description)
  values (v_user_id, p_token_hash, v_nick, p_description)
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitation + permission RPCs
-- ---------------------------------------------------------------------------

create or replace function public.set_checklist_permission(
  p_checklist_id uuid,
  p_grantee uuid,
  p_permission text
)
returns public.checklist_permissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_result public.checklist_permissions;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if p_permission not in ('view', 'edit') then
    raise exception 'Invalid permission';
  end if;
  select owner_user_id into v_owner from public.personal_checklists where id = p_checklist_id;
  if v_owner is distinct from v_actor then
    raise exception 'Only the checklist owner can change access';
  end if;
  if p_grantee = v_actor then
    raise exception 'Cannot grant access to yourself';
  end if;

  insert into public.checklist_permissions (checklist_id, grantee_user_id, permission, updated_at, revoked_at)
  values (p_checklist_id, p_grantee, p_permission, now(), null)
  on conflict (checklist_id, grantee_user_id)
  do update set permission = excluded.permission, updated_at = now(), revoked_at = null
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.revoke_checklist_permission(p_checklist_id uuid, p_grantee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  select owner_user_id into v_owner from public.personal_checklists where id = p_checklist_id;
  if v_owner is distinct from v_actor then
    raise exception 'Only the checklist owner can change access';
  end if;
  update public.checklist_permissions
    set revoked_at = now(), updated_at = now()
    where checklist_id = p_checklist_id and grantee_user_id = p_grantee;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.personal_checklists enable row level security;
alter table public.plan_groups enable row level security;
alter table public.plan_group_members enable row level security;
alter table public.checklist_permissions enable row level security;
alter table public.checklist_invitations enable row level security;

drop policy if exists personal_checklists_select on public.personal_checklists;
create policy personal_checklists_select on public.personal_checklists
  for select using (
    owner_user_id = auth.uid()
    or purchased_by_user_id = auth.uid()
    or exists (
      select 1 from public.checklist_permissions p
      where p.checklist_id = personal_checklists.id
        and p.grantee_user_id = auth.uid()
        and p.revoked_at is null
    )
    or exists (
      select 1
      from public.plan_group_members mine
      join public.plan_group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.checklist_id = personal_checklists.id
    )
  );

drop policy if exists plan_groups_select on public.plan_groups;
create policy plan_groups_select on public.plan_groups
  for select using (
    created_by = auth.uid()
    or exists (
      select 1 from public.plan_group_members m
      where m.group_id = plan_groups.id and m.user_id = auth.uid()
    )
  );

drop policy if exists plan_group_members_select on public.plan_group_members;
create policy plan_group_members_select on public.plan_group_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.plan_group_members m
      where m.group_id = plan_group_members.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists checklist_permissions_select on public.checklist_permissions;
create policy checklist_permissions_select on public.checklist_permissions
  for select using (
    grantee_user_id = auth.uid()
    or exists (
      select 1 from public.personal_checklists c
      where c.id = checklist_permissions.checklist_id and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists checklist_invitations_select on public.checklist_invitations;
create policy checklist_invitations_select on public.checklist_invitations
  for select using (
    invited_by_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''))
  );

drop policy if exists progress_select_connected on public.checklist_progress;
create policy progress_select_connected on public.checklist_progress
  for select using (public.can_read_owner_progress(user_id));

drop policy if exists household_progress_select on public.checklist_progress;
create policy household_progress_select on public.checklist_progress
  for select using (
    exists (
      select 1
      from public.plan_groups g
      join public.plan_group_members me on me.group_id = g.id
      join public.checklist_items i on i.id = checklist_progress.checklist_item_id
      join public.checklist_sections s on s.id = i.section_id
      join public.checklist_systems sys on sys.id = s.system_id
      where g.has_shared_household
        and g.created_by = checklist_progress.user_id
        and me.user_id = auth.uid()
        and me.status = 'active'
        and sys.access_tier = 'full'
    )
  );

drop policy if exists custom_items_select_connected on public.custom_checklist_items;
create policy custom_items_select_connected on public.custom_checklist_items
  for select using (public.can_read_owner_progress(user_id));

grant execute on function public.generate_public_checklist_id() to authenticated, service_role;
grant execute on function public.ensure_plan_group(uuid) to authenticated, service_role;
grant execute on function public.ensure_personal_checklist(uuid) to authenticated, service_role;
grant execute on function public.checklist_permission_for(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_read_owner_progress(uuid) to authenticated, service_role;
grant execute on function public.provision_purchase_checklists(uuid, uuid) to service_role;
grant execute on function public.set_checklist_permission(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_checklist_permission(uuid, uuid) to authenticated;
grant execute on function public.add_custom_item(uuid, text, text, uuid) to authenticated;
grant execute on function public.upsert_progress(uuid, boolean, text, uuid, uuid) to authenticated;
grant execute on function public.custom_item_cap(integer) to authenticated;
grant execute on function public.apply_purchase_entitlements(uuid) to service_role;
