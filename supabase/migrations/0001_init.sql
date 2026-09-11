-- Safety Prep List — initial schema, RLS, and helper functions
-- Apply with: supabase db push   OR run in the SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.plan_tier as enum ('none', 'core', 'full');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_kind as enum ('core', 'full', 'extra_device', 'upgrade_full');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'completed', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.access_tier as enum ('core', 'full');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Config & products (pricing lives here, not in the frontend)
-- ---------------------------------------------------------------------------

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  slug text primary key,
  name text not null,
  description text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  kind public.product_kind not null,
  grants_plan public.plan_tier,
  device_slots integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

insert into public.app_config (key, value) values
  ('pricing', jsonb_build_object(
    'core', jsonb_build_object('slug', 'core', 'amount_cents', 999, 'currency', 'USD'),
    'full', jsonb_build_object('slug', 'full', 'amount_cents', 1999, 'currency', 'USD'),
    'extra_device', jsonb_build_object('slug', 'extra_device', 'amount_cents', 500, 'currency', 'USD'),
    'upgrade_core_to_full', jsonb_build_object(
      'slug', 'upgrade_full',
      'amount_cents', 1000,
      'currency', 'USD',
      'credits_core_purchase', true,
      'notes', 'Charge this amount when upgrading Core to Full. Change in app_config without a frontend rebuild.'
    )
  )),
  ('support', jsonb_build_object(
    'email', 'support@example.com',
    'name', 'Safety Prep List Support'
  )),
  ('device_defaults', jsonb_build_object('included_slots', 2, 'max_personal_contacts', 25))
on conflict (key) do nothing;

insert into public.products (slug, name, description, amount_cents, kind, grants_plan, device_slots) values
  ('core', 'Core', 'Four core preparedness systems, contacts, printing, and two devices.', 999, 'core', 'core', 2),
  ('full', 'Full System', 'Everything in Core plus advanced systems and Video Vault.', 1999, 'full', 'full', 2),
  ('extra_device', 'Additional Device', 'Adds one registered device slot to an existing account.', 500, 'extra_device', null, 1),
  ('upgrade_full', 'Upgrade to Full System', 'Upgrade from Core. Price is configurable in app_config.', 1000, 'upgrade_full', 'full', 0)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  plan public.plan_tier not null default 'none',
  device_limit integer not null default 2 check (device_limit >= 0),
  role text not null default 'customer' check (role in ('customer', 'owner')),
  preferred_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------------

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  provider text not null default 'paypal',
  paypal_order_id text unique,
  paypal_capture_id text,
  product_code text unique not null,
  product_type public.product_kind not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  payment_status public.payment_status not null default 'pending',
  payer_email text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists purchases_user_id_idx on public.purchases (user_id);
create index if not exists purchases_product_code_idx on public.purchases (product_code);

-- ---------------------------------------------------------------------------
-- Entitlements
-- ---------------------------------------------------------------------------

create table if not exists public.account_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entitlement text not null,
  source_purchase_id uuid references public.purchases (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists account_entitlements_unique_flags
  on public.account_entitlements (user_id, entitlement)
  where entitlement in ('core', 'full', 'video_vault');

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_token_hash text not null,
  nickname text not null,
  device_description text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_token_hash)
);

create index if not exists devices_user_id_idx on public.devices (user_id);

-- ---------------------------------------------------------------------------
-- Checklist catalog (public, owner-editable)
-- ---------------------------------------------------------------------------

create table if not exists public.checklist_systems (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  time_label text,
  illustration_key text,
  access_tier public.access_tier not null default 'core',
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.checklist_sections (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.checklist_systems (id) on delete cascade,
  slug text not null,
  title text not null,
  intro text,
  sort_order integer not null default 0,
  unique (system_id, slug)
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.checklist_sections (id) on delete cascade,
  permanent_key text unique not null,
  text text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true
);

create index if not exists checklist_items_section_idx on public.checklist_items (section_id);

-- ---------------------------------------------------------------------------
-- User progress
-- ---------------------------------------------------------------------------

create table if not exists public.checklist_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items (id) on delete cascade,
  checked boolean not null default false,
  note text not null default '' check (char_length(note) <= 100),
  updated_by_device_id uuid references public.devices (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, checklist_item_id)
);

create index if not exists checklist_progress_user_idx on public.checklist_progress (user_id);

-- ---------------------------------------------------------------------------
-- Personal contacts
-- ---------------------------------------------------------------------------

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_user_idx on public.contacts (user_id);

-- ---------------------------------------------------------------------------
-- Public safety directory
-- ---------------------------------------------------------------------------

create table if not exists public.safety_contacts (
  id uuid primary key default gen_random_uuid(),
  state text, -- null = national; two-letter code otherwise
  category text not null,
  agency_name text not null,
  phone text,
  website text,
  source_url text,
  notes text,
  verified_at date,
  active boolean not null default true,
  sort_order integer not null default 0
);

create index if not exists safety_contacts_state_idx on public.safety_contacts (state);

-- ---------------------------------------------------------------------------
-- Video vault
-- ---------------------------------------------------------------------------

create table if not exists public.video_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text,
  thumbnail_url text,
  category text not null,
  source_name text,
  sort_order integer not null default 0,
  active boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Updated-at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at before update on public.contacts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create profile and attach a verified purchase by product code
-- ---------------------------------------------------------------------------

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
  v_limit integer := 0;
begin
  v_code := nullif(trim(coalesce(new.raw_user_meta_data->>'product_code', '')), '');

  if v_code is not null then
    select * into v_purchase
    from public.purchases
    where product_code = v_code
      and payment_status = 'completed'
      and user_id is null
    for update;

    if found then
      if v_purchase.product_type in ('core') then
        v_plan := 'core';
        v_limit := 2;
      elsif v_purchase.product_type in ('full', 'upgrade_full') then
        v_plan := 'full';
        v_limit := 2;
      end if;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, plan, device_limit)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    v_plan,
    case when v_plan = 'none' then 0 else greatest(v_limit, 2) end
  );

  if v_purchase.id is not null then
    update public.purchases
      set user_id = new.id
      where id = v_purchase.id;

    if v_plan = 'core' then
      insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
      values (new.id, 'core', v_purchase.id)
      on conflict do nothing;
    elsif v_plan = 'full' then
      insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
      values
        (new.id, 'core', v_purchase.id),
        (new.id, 'full', v_purchase.id),
        (new.id, 'video_vault', v_purchase.id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Device registration (hashed token only — never store the raw device id)
-- ---------------------------------------------------------------------------

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
            hint = 'Remove a device or purchase an additional slot.';
  end if;

  insert into public.devices (user_id, device_token_hash, nickname, device_description)
  values (v_user_id, p_token_hash, v_nick, p_description)
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.touch_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.devices
    set last_seen_at = now()
    where id = p_device_id
      and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Progress upsert used by the app (and offline flush)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_progress(
  p_item_id uuid,
  p_checked boolean,
  p_note text,
  p_device_id uuid
)
returns public.checklist_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_note text := left(coalesce(p_note, ''), 100);
  v_result public.checklist_progress;
  v_item public.checklist_items%rowtype;
  v_system public.checklist_systems%rowtype;
  v_plan public.plan_tier;
begin
  if v_user_id is null then
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

  select plan into v_plan from public.profiles where id = v_user_id;

  if v_system.access_tier = 'full' and v_plan <> 'full' then
    raise exception 'FULL_SYSTEM_REQUIRED';
  end if;

  if v_plan = 'none' then
    raise exception 'NO_ENTITLEMENT';
  end if;

  insert into public.checklist_progress (
    user_id, checklist_item_id, checked, note, updated_by_device_id, updated_at
  ) values (
    v_user_id, p_item_id, coalesce(p_checked, false), v_note, p_device_id, now()
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
-- Contact limit
-- ---------------------------------------------------------------------------

create or replace function public.enforce_contact_limit()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.contacts where user_id = new.user_id;
  if v_count >= 25 then
    raise exception 'CONTACT_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_new_contact()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'Not authenticated';
  end if;
  select count(*) into v_count from public.contacts where user_id = new.user_id;
  if v_count >= 25 then
    raise exception 'CONTACT_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_owner on public.contacts;
drop trigger if exists contacts_limit on public.contacts;
create trigger contacts_prepare before insert on public.contacts
for each row execute function public.prepare_new_contact();

-- ---------------------------------------------------------------------------
-- Owner helper (used by RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Apply entitlements after a verified purchase is linked
-- (also used by Edge Functions via service role)
-- ---------------------------------------------------------------------------

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
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.purchases enable row level security;
alter table public.account_entitlements enable row level security;
alter table public.devices enable row level security;
alter table public.checklist_systems enable row level security;
alter table public.checklist_sections enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_progress enable row level security;
alter table public.contacts enable row level security;
alter table public.safety_contacts enable row level security;
alter table public.video_resources enable row level security;
alter table public.products enable row level security;
alter table public.app_config enable row level security;

-- Catalog is readable by anyone (needed before login for marketing + after login)
drop policy if exists "catalog systems read" on public.checklist_systems;
create policy "catalog systems read" on public.checklist_systems
  for select using (active = true or public.is_owner());

drop policy if exists "catalog sections read" on public.checklist_sections;
create policy "catalog sections read" on public.checklist_sections
  for select using (
    exists (
      select 1 from public.checklist_systems s
      where s.id = system_id and (s.active = true or public.is_owner())
    )
  );

drop policy if exists "catalog items read" on public.checklist_items;
create policy "catalog items read" on public.checklist_items
  for select using (
    (active = true or public.is_owner())
    and exists (
      select 1
      from public.checklist_sections sec
      join public.checklist_systems s on s.id = sec.system_id
      where sec.id = section_id and (s.active = true or public.is_owner())
    )
  );

drop policy if exists "products read" on public.products;
create policy "products read" on public.products
  for select using (active = true or public.is_owner());

drop policy if exists "config read" on public.app_config;
create policy "config read" on public.app_config
  for select using (true);

drop policy if exists "safety read" on public.safety_contacts;
create policy "safety read" on public.safety_contacts
  for select using (active = true or public.is_owner());

drop policy if exists "videos read" on public.video_resources;
create policy "videos read" on public.video_resources
  for select using (active = true or public.is_owner());

-- Owner write policies for catalog
drop policy if exists "owner write systems" on public.checklist_systems;
create policy "owner write systems" on public.checklist_systems
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner write sections" on public.checklist_sections;
create policy "owner write sections" on public.checklist_sections
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner write items" on public.checklist_items;
create policy "owner write items" on public.checklist_items
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner write safety" on public.safety_contacts;
create policy "owner write safety" on public.safety_contacts
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner write videos" on public.video_resources;
create policy "owner write videos" on public.video_resources
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner write products" on public.products;
create policy "owner write products" on public.products
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner write config" on public.app_config;
create policy "owner write config" on public.app_config
  for all using (public.is_owner()) with check (public.is_owner());

-- Profiles
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (id = auth.uid() or public.is_owner());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and plan = (select plan from public.profiles where id = auth.uid())
    and device_limit = (select device_limit from public.profiles where id = auth.uid())
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Purchases: users see their own completed purchases
drop policy if exists "own purchases read" on public.purchases;
create policy "own purchases read" on public.purchases
  for select using (user_id = auth.uid() or public.is_owner());

drop policy if exists "own entitlements read" on public.account_entitlements;
create policy "own entitlements read" on public.account_entitlements
  for select using (user_id = auth.uid() or public.is_owner());

-- Devices
drop policy if exists "own devices read" on public.devices;
create policy "own devices read" on public.devices
  for select using (user_id = auth.uid());

drop policy if exists "own devices update" on public.devices;
create policy "own devices update" on public.devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own devices delete" on public.devices;
create policy "own devices delete" on public.devices
  for delete using (user_id = auth.uid());

-- Progress
drop policy if exists "own progress" on public.checklist_progress;
create policy "own progress" on public.checklist_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Contacts
drop policy if exists "own contacts" on public.contacts;
create policy "own contacts" on public.contacts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.checklist_progress;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.contacts;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.devices;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.checklist_systems, public.checklist_sections, public.checklist_items,
  public.safety_contacts, public.video_resources, public.products, public.app_config
  to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.purchases, public.account_entitlements to authenticated;
grant select, update, delete on public.devices to authenticated;
grant select, insert, update, delete on public.checklist_progress to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;

grant execute on function public.register_device(text, text, text) to authenticated;
grant execute on function public.touch_device(uuid) to authenticated;
grant execute on function public.upsert_progress(uuid, boolean, text, uuid) to authenticated;
grant execute on function public.apply_purchase_entitlements(uuid) to service_role;
