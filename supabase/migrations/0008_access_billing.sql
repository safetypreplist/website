-- Recurring Safety Prep List access + one-time checklist fee.
-- Existing plan = core/full customers are grandfathered: they keep access,
-- checklists, progress, Survival Vault, and are not auto-enrolled in a new charge.

do $$
begin
  alter type public.product_kind add value 'access_monthly';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.product_kind add value 'access_annual';
exception
  when duplicate_object then null;
end $$;

-- access_monthly / access_annual product rows are inserted in 0009.
-- Postgres cannot use a new enum value until this migration has committed.

update public.products
set
  name = 'One-Time Checklist Fee',
  description = 'One personal Safety Prep Checklist. Charged once when the checklist is created. Safety Prep List access is billed separately as Monthly Access or Annual Access.'
where slug = 'core';

alter table public.purchases
  add column if not exists access_interval text,
  add column if not exists checklist_cents integer not null default 0,
  add column if not exists access_cents integer not null default 0,
  add column if not exists vault_cents integer not null default 0;

alter table public.purchases
  drop constraint if exists purchases_access_interval_check;

alter table public.purchases
  add constraint purchases_access_interval_check
  check (access_interval is null or access_interval in ('monthly', 'annual'));

alter table public.profiles
  add column if not exists access_interval text,
  add column if not exists access_status text not null default 'none',
  add column if not exists access_renews_at timestamptz,
  add column if not exists checklist_fee_paid boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_access_interval_check;

alter table public.profiles
  add constraint profiles_access_interval_check
  check (access_interval is null or access_interval in ('monthly', 'annual'));

alter table public.profiles
  drop constraint if exists profiles_access_status_check;

alter table public.profiles
  add constraint profiles_access_status_check
  check (access_status in ('none', 'active', 'grandfathered', 'past_due'));

alter table public.plan_groups
  add column if not exists access_interval text,
  add column if not exists access_status text not null default 'none',
  add column if not exists access_renews_at timestamptz,
  add column if not exists billed_seats integer not null default 0;

alter table public.personal_checklists
  add column if not exists checklist_fee_paid boolean not null default true,
  add column if not exists access_interval text,
  add column if not exists access_renews_at timestamptz;

-- Existing paid accounts keep access. Do not start a new subscription or re-charge the checklist fee.
update public.profiles
set
  checklist_fee_paid = true,
  access_status = 'grandfathered'
where plan in ('core', 'full')
  and access_status in ('none', 'grandfathered');

update public.plan_groups g
set access_status = 'grandfathered'
from public.profiles p
where g.created_by = p.id
  and p.access_status = 'grandfathered'
  and g.access_status = 'none';

create or replace function public.record_access_from_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.purchases%rowtype;
  v_group uuid;
  v_renews timestamptz;
begin
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found or v_p.user_id is null or v_p.payment_status <> 'completed' then
    return;
  end if;

  if v_p.product_type = 'upgrade_full' or (v_p.includes_household and v_p.product_type <> 'core') then
    return;
  end if;

  if v_p.access_interval is null or v_p.access_interval not in ('monthly', 'annual') then
    return;
  end if;

  v_group := public.ensure_plan_group(v_p.user_id);
  v_renews := case
    when v_p.access_interval = 'annual' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  update public.plan_groups
  set
    access_interval = v_p.access_interval,
    access_status = case when access_status = 'grandfathered' then 'grandfathered' else 'active' end,
    access_renews_at = coalesce(access_renews_at, v_renews),
    billed_seats = billed_seats + greatest(coalesce(v_p.quantity, 1), 1)
  where id = v_group;

  update public.profiles
  set
    access_interval = case when access_status = 'grandfathered' then access_interval else v_p.access_interval end,
    access_status = case when access_status = 'grandfathered' then 'grandfathered' else 'active' end,
    access_renews_at = case when access_status = 'grandfathered' then access_renews_at else v_renews end,
    checklist_fee_paid = true
  where id = v_p.user_id;
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
end;
$$;
