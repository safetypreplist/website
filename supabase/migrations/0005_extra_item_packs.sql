update public.products
set
  name = 'Additional checklist items',
  description = 'Adds 10 extra custom items in each checklist section.',
  amount_cents = 500,
  kind = 'extra_items',
  grants_plan = null,
  device_slots = 0,
  active = true
where slug = 'extra_items';

drop index if exists public.account_entitlements_extra_items;

create or replace function public.custom_item_cap(p_bonus integer)
returns integer
language sql
immutable
as $$
  select 10 + greatest(coalesce(p_bonus, 0), 0);
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
      set custom_item_bonus = custom_item_bonus + 10
      where id = v_p.user_id;
    insert into public.account_entitlements (user_id, entitlement, source_purchase_id)
    values (v_p.user_id, 'extra_items', v_p.id);
  end if;
end;
$$;

grant execute on function public.custom_item_cap(integer) to authenticated;
grant execute on function public.apply_purchase_entitlements(uuid) to service_role;
