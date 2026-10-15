-- A customer who already has their own checklist buys additional checklists only.
-- Each one paid for becomes an open seat; their own checklist is never counted again.
-- Previously this branch created a single seat no matter how many were purchased.

CREATE OR REPLACE FUNCTION public.apply_purchase_entitlements(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_p public.purchases%rowtype;
  v_existing boolean := false;
  v_seat uuid;
  i integer;
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
      for i in 1..greatest(coalesce(v_p.quantity, 1), 1) loop
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
        )
        returning id into v_seat;
        insert into public.plan_group_members (group_id, checklist_id, role, status)
        values (public.ensure_plan_group(v_p.user_id), v_seat, 'member', 'pending')
        on conflict do nothing;
      end loop;
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

revoke all on function public.apply_purchase_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.apply_purchase_entitlements(uuid) to service_role;
