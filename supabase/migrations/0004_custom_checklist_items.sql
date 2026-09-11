alter table public.profiles
  add column if not exists custom_item_bonus integer not null default 0;

insert into public.products (slug, name, description, amount_cents, kind, grants_plan, device_slots, active)
values (
  'extra_items',
  'Additional checklist items',
  'Adds 20 extra custom items in each checklist section.',
  800,
  'extra_items',
  null,
  0,
  true
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    amount_cents = excluded.amount_cents,
    kind = excluded.kind,
    grants_plan = excluded.grants_plan,
    device_slots = excluded.device_slots,
    active = true;

create table if not exists public.custom_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  section_id uuid not null references public.checklist_sections (id) on delete cascade,
  text text not null,
  description text,
  sort_order integer not null default 0,
  checked boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_checklist_items_user_section_idx
  on public.custom_checklist_items (user_id, section_id);

drop trigger if exists custom_checklist_items_updated_at on public.custom_checklist_items;
create trigger custom_checklist_items_updated_at before update on public.custom_checklist_items
  for each row execute function public.set_updated_at();

create unique index if not exists account_entitlements_extra_items
  on public.account_entitlements (user_id, entitlement)
  where entitlement = 'extra_items';

create or replace function public.custom_item_cap(p_bonus integer)
returns integer
language sql
immutable
as $$
  select 5 + least(greatest(coalesce(p_bonus, 0), 0), 20);
$$;

create or replace function public.add_custom_item(
  p_section_id uuid,
  p_text text,
  p_description text default null
)
returns public.custom_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bonus integer := 0;
  v_count integer;
  v_cap integer;
  v_sort integer;
  v_result public.custom_checklist_items;
  v_text text := left(trim(coalesce(p_text, '')), 120);
  v_desc text := nullif(left(trim(coalesce(p_description, '')), 280), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_text = '' then
    raise exception 'Item text is required';
  end if;
  if not exists (select 1 from public.checklist_sections where id = p_section_id) then
    raise exception 'Unknown section';
  end if;

  select custom_item_bonus into v_bonus from public.profiles where id = v_user_id;
  v_cap := public.custom_item_cap(v_bonus);

  select count(*) into v_count
  from public.custom_checklist_items
  where user_id = v_user_id and section_id = p_section_id;

  if v_count >= v_cap then
    raise exception 'ITEM_LIMIT_REACHED';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.custom_checklist_items
  where user_id = v_user_id and section_id = p_section_id;

  insert into public.custom_checklist_items (user_id, section_id, text, description, sort_order)
  values (v_user_id, p_section_id, v_text, v_desc, v_sort)
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
  v_user_id uuid := auth.uid();
  v_result public.custom_checklist_items;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.custom_checklist_items
    set checked = coalesce(p_checked, false),
        note = left(coalesce(p_note, ''), 100)
    where id = p_item_id and user_id = v_user_id
    returning * into v_result;

  if not found then
    raise exception 'Unknown custom item';
  end if;

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
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.custom_checklist_items
  where id = p_item_id and user_id = v_user_id;
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
begin
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found or v_p.user_id is null or v_p.payment_status <> 'completed' then
    return;
  end if;

  if v_p.product_type = 'core' then
    update public.profiles
      set plan = case when plan = 'full' then 'full' else 'core' end,
          device_limit = greatest(device_limit, 2)
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'core', v_p.id)
    on conflict do nothing;
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
  elsif v_p.product_type = 'extra_device' then
    update public.profiles
      set device_limit = device_limit + 1
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'extra_device', v_p.id);
  elsif v_p.product_type = 'extra_items' then
    update public.profiles
      set custom_item_bonus = greatest(custom_item_bonus, 20)
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'extra_items', v_p.id)
    on conflict do nothing;
  end if;
end;
$$;

alter table public.custom_checklist_items enable row level security;

drop policy if exists "own custom items" on public.custom_checklist_items;
create policy "own custom items" on public.custom_checklist_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.custom_checklist_items to authenticated;
grant execute on function public.custom_item_cap(integer) to authenticated;
grant execute on function public.add_custom_item(uuid, text, text) to authenticated;
grant execute on function public.save_custom_item_progress(uuid, boolean, text) to authenticated;
grant execute on function public.remove_custom_item(uuid) to authenticated;
grant execute on function public.apply_purchase_entitlements(uuid) to service_role;

do $$ begin
  alter publication supabase_realtime add table public.custom_checklist_items;
exception when others then null;
end $$;
