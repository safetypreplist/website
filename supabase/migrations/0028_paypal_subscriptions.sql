-- PayPal Subscriptions: recurring billing, paid-through tracking, and access expiry per personal checklist.
-- A checklist with access_ends_at = null never expires (grandfathered and pre-subscription purchases).

begin;

create table if not exists public.paypal_billing_refs (
  key text primary key,
  paypal_id text not null,
  created_at timestamptz not null default now()
);
alter table public.paypal_billing_refs enable row level security;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  paypal_subscription_id text not null unique,
  paypal_plan_id text not null,
  user_id uuid references public.profiles(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  purpose text not null default 'new' check (purpose in ('new', 'add_member', 'renew')),
  access_interval text not null check (access_interval in ('monthly', 'annual')),
  quantity integer not null default 1 check (quantity >= 1),
  regular_cents integer not null,
  first_payment_cents integer not null,
  vault_cents integer not null default 0,
  discount_code text,
  discount_cents integer not null default 0,
  discount_payments integer,
  status text not null default 'approval_pending'
    check (status in ('approval_pending', 'active', 'suspended', 'cancelled', 'expired')),
  paid_through timestamptz,
  access_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;
drop policy if exists "own subscriptions read" on public.subscriptions;
create policy "own subscriptions read" on public.subscriptions
  for select using (user_id = auth.uid());

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  paypal_sale_id text not null unique,
  amount_cents integer not null,
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.subscription_payments enable row level security;

alter table public.purchases add column if not exists paypal_subscription_id text;
create unique index if not exists purchases_paypal_subscription_idx
  on public.purchases (paypal_subscription_id) where paypal_subscription_id is not null;

alter table public.personal_checklists
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists access_ends_at timestamptz;

alter table public.profiles add column if not exists access_ends_at timestamptz;
alter table public.profiles drop constraint if exists profiles_access_status_check;
alter table public.profiles
  add constraint profiles_access_status_check
  check (access_status in ('none', 'active', 'grandfathered', 'past_due', 'cancelled', 'expired'));

-- Accounts that paid under the old one-time checkout keep access with no expiry.
update public.profiles
set access_status = 'grandfathered'
where plan <> 'none' and access_status <> 'grandfathered';

create or replace function public.checklist_access_open(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.personal_checklists
    where owner_user_id = p_user_id
      and status = 'active'
      and access_ends_at is not null
      and access_ends_at < now()
  );
$$;

create or replace function public.sync_subscription_access(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.subscriptions%rowtype;
begin
  select * into v_s from public.subscriptions where id = p_subscription_id;
  if not found then
    return;
  end if;

  update public.personal_checklists
  set access_interval = v_s.access_interval,
      access_renews_at = v_s.paid_through,
      access_ends_at = v_s.access_ends_at
  where subscription_id = v_s.id;

  if v_s.user_id is not null and v_s.purpose <> 'add_member' then
    update public.profiles
    set access_interval = v_s.access_interval,
        access_renews_at = v_s.paid_through,
        access_ends_at = v_s.access_ends_at,
        access_status = case
          when access_status = 'grandfathered' then 'grandfathered'
          when v_s.access_ends_at is not null and v_s.access_ends_at < now() then 'expired'
          when v_s.status = 'cancelled' then 'cancelled'
          when v_s.status = 'suspended' or (v_s.paid_through is not null and v_s.paid_through < now()) then 'past_due'
          else 'active'
        end
    where id = v_s.user_id;
  end if;
end;
$$;

-- Links checklists created by this purchase (same transaction) to its PayPal subscription.
create or replace function public.link_purchase_subscription(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.purchases%rowtype;
  v_s public.subscriptions%rowtype;
begin
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found or v_p.paypal_subscription_id is null or v_p.user_id is null then
    return;
  end if;
  select * into v_s from public.subscriptions where paypal_subscription_id = v_p.paypal_subscription_id;
  if not found then
    return;
  end if;

  update public.subscriptions
  set user_id = v_p.user_id, purchase_id = v_p.id, updated_at = now()
  where id = v_s.id;

  if v_s.purpose = 'renew' then
    update public.personal_checklists
    set subscription_id = v_s.id
    where status <> 'cancelled'
      and subscription_id in (
        select id from public.subscriptions
        where user_id = v_p.user_id and id <> v_s.id and status in ('cancelled', 'expired', 'suspended')
      );
  else
    update public.personal_checklists
    set subscription_id = v_s.id
    where subscription_id is null
      and created_at = now()
      and (owner_user_id = v_p.user_id or purchased_by_user_id = v_p.user_id);
  end if;

  perform public.sync_subscription_access(v_s.id);
end;
$$;

revoke all on function public.sync_subscription_access(uuid) from public, anon, authenticated;
revoke all on function public.link_purchase_subscription(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_purchase_entitlements(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            when plan = 'full'::public.plan_tier or v_p.includes_household then 'full'::public.plan_tier
            else 'core'::public.plan_tier
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
      insert into public.personal_checklists (public_id, purchased_by_user_id, status, checklist_fee_paid, access_interval, access_renews_at)
      values (
        public.generate_public_checklist_id(),
        v_p.user_id,
        'pending_claim',
        true,
        v_p.access_interval,
        case
          when v_p.access_interval = 'annual' then now() + interval '1 year'
          when v_p.access_interval = 'monthly' then now() + interval '1 month'
          else null
        end
      );
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
      set plan = 'full'::public.plan_tier,
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
    update public.profiles
      set device_limit = device_limit + 1
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'extra_device', v_p.id);
  elsif v_p.product_type = 'extra_items' then
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'extra_items', v_p.id);
  end if;

  perform public.record_access_from_purchase(p_purchase_id);
  perform public.link_purchase_subscription(p_purchase_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_progress(p_item_id uuid, p_checked boolean, p_note text, p_device_id uuid, p_owner_user_id uuid DEFAULT NULL::uuid)
 RETURNS checklist_progress
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.add_custom_item(p_section_id uuid, p_text text, p_description text DEFAULT NULL::text, p_owner_user_id uuid DEFAULT NULL::uuid)
 RETURNS custom_checklist_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not public.checklist_access_open(v_owner) then
    raise exception 'ACCESS_ENDED';
  end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.save_custom_item_progress(p_item_id uuid, p_checked boolean, p_note text)
 RETURNS custom_checklist_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not public.checklist_access_open(v_owner) then
    raise exception 'ACCESS_ENDED';
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
$function$;

commit;
