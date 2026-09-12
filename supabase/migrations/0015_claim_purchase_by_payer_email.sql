-- If signup has no Product ID (or it is already claimed), attach an unclaimed
-- completed purchase whose PayPal payer_email matches the new account email.

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
  end if;

  return new;
end;
$$;
