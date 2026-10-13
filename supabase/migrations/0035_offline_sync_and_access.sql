-- Offline sync, device enforcement, and access hardening.
-- Backward compatible: the existing RPCs keep their signatures so already-installed
-- copies of the app keep working until they update.

-- 1. Customers can only change personal fields on their own profile.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_allowed text[] := array[
    'full_name', 'first_name', 'last_name', 'display_name', 'phone',
    'avatar_url', 'preferred_state', 'updated_at'
  ];
begin
  if current_user in ('authenticated', 'anon')
     and not public.is_owner()
     and (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'PROTECTED_FIELD' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- 2. Progress and custom items are only written through the checked RPCs below.
revoke insert, update, delete on public.checklist_progress from anon, authenticated;
revoke insert, update, delete on public.custom_checklist_items from anon, authenticated;

-- 3. When the change was made on the device (used to resolve conflicts between devices).
alter table public.checklist_progress add column if not exists edited_at timestamptz;
alter table public.custom_checklist_items add column if not exists edited_at timestamptz;

-- 4. Devices.
create or replace function public.device_from_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_seen timestamptz;
begin
  if auth.uid() is null or coalesce(length(p_token), 0) < 32 then
    return null;
  end if;
  select id, last_seen_at into v_id, v_seen
  from public.devices
  where user_id = auth.uid()
    and device_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if v_id is not null and v_seen < now() - interval '10 minutes' then
    update public.devices set last_seen_at = now() where id = v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.device_from_token(text) from public, anon, authenticated;

create or replace function public.register_device(p_token_hash text, p_nickname text, p_description text default null)
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

  if v_count >= coalesce(v_limit, 0) and not public.is_owner() then
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

-- The shared preview login is used from the owner console on many browsers.
update public.profiles set device_limit = greatest(device_limit, 20) where lower(email) = 'demo@demo.com';

-- 5. Entitlement helpers.
create or replace function public.user_has_vault(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user and plan = 'full')
      or exists (
        select 1
        from public.plan_group_members m
        join public.plan_groups g on g.id = m.group_id
        where m.user_id = p_user and m.status = 'active' and g.has_shared_household
      );
$$;

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
      and (s.access_tier = 'core' or public.user_has_vault(auth.uid()))
  );
$$;

-- Checklist item text is for paying customers; Survival Vault items need the Vault.
drop policy if exists "catalog items read" on public.checklist_items;
create policy "catalog items read" on public.checklist_items
  for select using (
    public.is_owner() or (active = true and public.can_read_catalog_section(section_id))
  );

-- What the device caches to decide offline access. The server stays the authority on every sync.
create or replace function public.my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plan_tier;
  v_ends timestamptz;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  select plan into v_plan from public.profiles where id = v_user;
  select access_ends_at into v_ends
  from public.personal_checklists
  where owner_user_id = v_user and status = 'active'
  order by access_ends_at nulls first
  limit 1;
  return jsonb_build_object(
    'user_id', v_user,
    'plan', coalesce(v_plan::text, 'none'),
    'vault', public.user_has_vault(v_user),
    'access_ends_at', v_ends,
    'server_time', now()
  );
end;
$$;

revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- 6. Progress writes. One internal writer, two entry points.
create or replace function public.write_progress(
  p_actor uuid,
  p_device uuid,
  p_item_id uuid,
  p_checked boolean,
  p_note text,
  p_owner_user_id uuid,
  p_edited_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_note text := left(coalesce(p_note, ''), 100);
  v_item public.checklist_items%rowtype;
  v_system public.checklist_systems%rowtype;
  v_plan public.plan_tier;
  v_perm text;
  v_checklist uuid;
  v_household boolean := false;
  v_existing public.checklist_progress%rowtype;
  v_result public.checklist_progress;
begin
  select * into v_item from public.checklist_items where id = p_item_id;
  if not found or v_item.active is not true then
    raise exception 'Unknown checklist item';
  end if;

  select s.* into v_system
  from public.checklist_sections sec
  join public.checklist_systems s on s.id = sec.system_id
  where sec.id = v_item.section_id;

  v_owner := coalesce(p_owner_user_id, p_actor);
  if not public.checklist_access_open(v_owner) then
    raise exception 'ACCESS_ENDED';
  end if;

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
    where m.user_id = coalesce(p_owner_user_id, p_actor) and m.status = 'active'
    order by g.created_at
    limit 1;
    v_owner := coalesce(v_owner, coalesce(p_owner_user_id, p_actor));
    if p_actor <> v_owner and not exists (
      select 1 from public.plan_group_members m
      where m.user_id = p_actor and m.status = 'active'
        and m.group_id in (select group_id from public.plan_group_members where user_id = v_owner)
    ) then
      raise exception 'CHECKLIST_VIEW_ONLY';
    end if;
  else
    if v_owner <> p_actor then
      select id into v_checklist from public.personal_checklists where owner_user_id = v_owner and status = 'active' limit 1;
      v_perm := public.checklist_permission_for(v_checklist, p_actor);
      if v_perm is distinct from 'edit' then
        raise exception 'CHECKLIST_VIEW_ONLY';
      end if;
    end if;
  end if;

  select * into v_existing
  from public.checklist_progress
  where user_id = v_owner and checklist_item_id = p_item_id
  for update;
  if found and coalesce(v_existing.edited_at, v_existing.updated_at) > p_edited_at then
    return jsonb_build_object('applied', false, 'row', to_jsonb(v_existing));
  end if;

  insert into public.checklist_progress (
    user_id, checklist_item_id, checked, note, updated_by_device_id, updated_at, edited_at
  ) values (
    v_owner, p_item_id, coalesce(p_checked, false), v_note, p_device, now(), p_edited_at
  )
  on conflict (user_id, checklist_item_id)
  do update set
    checked = excluded.checked,
    note = excluded.note,
    updated_by_device_id = excluded.updated_by_device_id,
    updated_at = now(),
    edited_at = excluded.edited_at
  returning * into v_result;

  return jsonb_build_object('applied', true, 'row', to_jsonb(v_result));
end;
$$;

revoke all on function public.write_progress(uuid, uuid, uuid, boolean, text, uuid, timestamptz) from public, anon, authenticated;

-- Used by the current app. Writes always win, but only from a registered device.
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
  v_out jsonb;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if p_device_id is null or not exists (select 1 from public.devices where id = p_device_id and user_id = v_actor) then
    raise exception 'DEVICE_NOT_REGISTERED';
  end if;
  v_out := public.write_progress(v_actor, p_device_id, p_item_id, p_checked, p_note, p_owner_user_id, now());
  return jsonb_populate_record(null::public.checklist_progress, v_out -> 'row');
end;
$$;

-- Used by the offline-capable app. Older edits never overwrite newer ones.
create or replace function public.save_progress(
  p_item_id uuid,
  p_checked boolean,
  p_note text,
  p_owner_user_id uuid,
  p_edited_at timestamptz,
  p_device_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_device uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  v_device := public.device_from_token(p_device_token);
  if v_device is null then
    raise exception 'DEVICE_NOT_REGISTERED';
  end if;
  return public.write_progress(
    v_actor, v_device, p_item_id, p_checked, p_note, p_owner_user_id,
    least(coalesce(p_edited_at, now()), now())
  );
end;
$$;

revoke all on function public.save_progress(uuid, boolean, text, uuid, timestamptz, text) from public, anon;
grant execute on function public.save_progress(uuid, boolean, text, uuid, timestamptz, text) to authenticated;

-- 7. Custom items for the offline-capable app.
create or replace function public.custom_item_owner_check(p_actor uuid, p_owner uuid, p_section_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checklist uuid;
  v_perm text;
  v_tier public.access_tier;
begin
  if not public.checklist_access_open(p_owner) then
    raise exception 'ACCESS_ENDED';
  end if;
  if p_owner <> p_actor then
    select id into v_checklist from public.personal_checklists where owner_user_id = p_owner and status = 'active' limit 1;
    v_perm := public.checklist_permission_for(v_checklist, p_actor);
    if v_perm is distinct from 'edit' then
      raise exception 'CHECKLIST_VIEW_ONLY';
    end if;
  end if;
  select s.access_tier into v_tier
  from public.checklist_sections sec
  join public.checklist_systems s on s.id = sec.system_id
  where sec.id = p_section_id;
  if v_tier = 'full' and not public.user_has_vault(p_owner) then
    raise exception 'FULL_SYSTEM_REQUIRED';
  end if;
end;
$$;

revoke all on function public.custom_item_owner_check(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.create_custom_item(
  p_id uuid,
  p_section_id uuid,
  p_text text,
  p_description text,
  p_owner_user_id uuid,
  p_device_token text
)
returns public.custom_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_existing public.custom_checklist_items;
  v_result public.custom_checklist_items;
  v_text text := left(trim(coalesce(p_text, '')), 120);
  v_desc text := nullif(left(trim(coalesce(p_description, '')), 280), '');
  v_count integer;
  v_sort integer;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if public.device_from_token(p_device_token) is null then
    raise exception 'DEVICE_NOT_REGISTERED';
  end if;
  v_owner := coalesce(p_owner_user_id, v_actor);

  if p_id is not null then
    select * into v_existing from public.custom_checklist_items where id = p_id;
    if found then
      if v_existing.user_id <> v_owner then
        raise exception 'Unknown custom item';
      end if;
      return v_existing;
    end if;
  end if;

  if v_text = '' then
    raise exception 'Item text is required';
  end if;
  if not exists (select 1 from public.checklist_sections where id = p_section_id) then
    raise exception 'Unknown section';
  end if;
  perform public.custom_item_owner_check(v_actor, v_owner, p_section_id);

  select count(*) into v_count
  from public.custom_checklist_items
  where user_id = v_owner and section_id = p_section_id;
  if v_count >= 5 then
    raise exception 'ITEM_LIMIT_REACHED';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.custom_checklist_items
  where user_id = v_owner and section_id = p_section_id;

  insert into public.custom_checklist_items (id, user_id, section_id, text, description, sort_order, edited_at)
  values (coalesce(p_id, gen_random_uuid()), v_owner, p_section_id, v_text, v_desc, v_sort, now())
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.create_custom_item(uuid, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.create_custom_item(uuid, uuid, text, text, uuid, text) to authenticated;

create or replace function public.save_custom_progress(
  p_item_id uuid,
  p_checked boolean,
  p_note text,
  p_edited_at timestamptz,
  p_device_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.custom_checklist_items;
  v_result public.custom_checklist_items;
  v_edited timestamptz := least(coalesce(p_edited_at, now()), now());
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if public.device_from_token(p_device_token) is null then
    raise exception 'DEVICE_NOT_REGISTERED';
  end if;
  select * into v_item from public.custom_checklist_items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('applied', false, 'missing', true);
  end if;
  perform public.custom_item_owner_check(v_actor, v_item.user_id, v_item.section_id);
  if coalesce(v_item.edited_at, v_item.updated_at) > v_edited then
    return jsonb_build_object('applied', false, 'row', to_jsonb(v_item));
  end if;
  update public.custom_checklist_items
    set checked = coalesce(p_checked, false),
        note = left(coalesce(p_note, ''), 100),
        edited_at = v_edited
    where id = p_item_id
  returning * into v_result;
  return jsonb_build_object('applied', true, 'row', to_jsonb(v_result));
end;
$$;

revoke all on function public.save_custom_progress(uuid, boolean, text, timestamptz, text) from public, anon;
grant execute on function public.save_custom_progress(uuid, boolean, text, timestamptz, text) to authenticated;

create or replace function public.delete_custom_item(p_item_id uuid, p_device_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.custom_checklist_items;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if public.device_from_token(p_device_token) is null then
    raise exception 'DEVICE_NOT_REGISTERED';
  end if;
  select * into v_item from public.custom_checklist_items where id = p_item_id;
  if not found then
    return;
  end if;
  perform public.custom_item_owner_check(v_actor, v_item.user_id, v_item.section_id);
  delete from public.custom_checklist_items where id = p_item_id;
end;
$$;

revoke all on function public.delete_custom_item(uuid, text) from public, anon;
grant execute on function public.delete_custom_item(uuid, text) to authenticated;
