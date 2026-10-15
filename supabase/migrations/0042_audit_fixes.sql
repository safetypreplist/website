-- Account deletion, invite email binding, and edge-function rate limits.

begin;

alter table public.purchases
  add column if not exists retired_at timestamptz;

comment on column public.purchases.retired_at is 'Set when the buyer deletes their account so the purchase cannot be silently reclaimed on a new signup.';

create index if not exists purchases_retired_idx on public.purchases (retired_at)
  where retired_at is null;

create or replace function public.claim_family_seat(p_user_id uuid, p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.checklist_invitations%rowtype;
  v_seat public.personal_checklists%rowtype;
  v_plan public.plan_tier;
begin
  if p_user_id is null or coalesce(btrim(p_token), '') = '' then
    return null;
  end if;

  select * into v_inv
  from public.checklist_invitations
  where token_hash = public.invite_token_hash(p_token)
    and status = 'pending'
    and expires_at > now()
  for update;
  if v_inv.id is null then
    return null;
  end if;

  if v_inv.invited_email is not null and not exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and p.email is not null
      and lower(p.email) = lower(v_inv.invited_email)
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.personal_checklists
    where owner_user_id = p_user_id and status = 'active'
  ) then
    return null;
  end if;

  select * into v_seat
  from public.personal_checklists
  where id = v_inv.checklist_id
    and status = 'pending_claim'
    and owner_user_id is null
  for update;
  if v_seat.id is null then
    return null;
  end if;

  update public.personal_checklists
  set owner_user_id = p_user_id, status = 'active'
  where id = v_seat.id;

  update public.plan_group_members
  set user_id = p_user_id, status = 'active', joined_at = now()
  where checklist_id = v_seat.id;
  if not found and v_inv.group_id is not null then
    insert into public.plan_group_members (group_id, checklist_id, user_id, role, status)
    values (v_inv.group_id, v_seat.id, p_user_id, 'member', 'active')
    on conflict (group_id, checklist_id) do update set user_id = excluded.user_id, status = 'active';
  end if;

  select case when p.plan = 'full'::public.plan_tier then 'full'::public.plan_tier else 'core'::public.plan_tier end
  into v_plan
  from public.profiles p
  where p.id = v_seat.purchased_by_user_id;

  update public.profiles
  set plan = case when plan = 'full'::public.plan_tier then plan else coalesce(v_plan, 'core'::public.plan_tier) end,
      device_limit = greatest(device_limit, 2)
  where id = p_user_id;

  insert into public.account_entitlements (user_id, entitlement)
  select p_user_id, 'core'
  where not exists (
    select 1 from public.account_entitlements where user_id = p_user_id and entitlement = 'core'
  );

  update public.checklist_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_inv.id;

  perform public.sync_seat_grants(v_seat.id);

  return v_seat.id;
end;
$$;

revoke all on function public.claim_family_seat(uuid, text) from public, anon, authenticated;

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
  v_seat uuid;
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
      and retired_at is null
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
        and p.retired_at is null
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
  else
    v_seat := public.claim_family_seat(new.id, new.raw_user_meta_data->>'invite_token');
    if v_seat is not null then
      perform public.save_family_grants(new.id, new.raw_user_meta_data->'family_permissions');
    end if;
  end if;

  return new;
end;
$$;

create table if not exists public.edge_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

alter table public.edge_rate_limits enable row level security;

create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_key is null or length(btrim(p_key)) < 1 or p_limit < 1 or p_window_seconds < 1 then
    return true;
  end if;

  insert into public.edge_rate_limits as r (key, window_start, count)
  values (left(btrim(p_key), 200), v_now, 1)
  on conflict (key) do update
    set
      window_start = case
        when r.window_start <= v_now - make_interval(secs => p_window_seconds) then v_now
        else r.window_start
      end,
      count = case
        when r.window_start <= v_now - make_interval(secs => p_window_seconds) then 1
        else r.count + 1
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;

commit;
