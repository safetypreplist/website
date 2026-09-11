-- Signup failed with "Database error saving new user" because
-- apply_purchase_entitlements assigned a CASE of text literals to plan_tier.
-- Postgres will not implicitly cast text to an enum.

create or replace function public.generate_public_checklist_id()
returns text
language plpgsql
security definer
set search_path = public
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
end;
$$;
