-- Print tracking (printing a checklist ends refund eligibility) and owner-managed refund requests.

begin;

create table if not exists public.print_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  list_slug text,
  source text not null check (source in ('button', 'shortcut', 'browser')),
  blank boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists print_events_user_idx on public.print_events (user_id, created_at);

alter table public.print_events enable row level security;

drop policy if exists "print events readable by self or owner" on public.print_events;
create policy "print events readable by self or owner" on public.print_events
  for select using (user_id = auth.uid() or public.is_owner());

create or replace function public.record_print(p_list text, p_source text, p_blank boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_source not in ('button', 'shortcut', 'browser') then
    raise exception 'Invalid print source';
  end if;
  -- One print can fire both the button handler and the browser's beforeprint event.
  if exists (
    select 1 from public.print_events
    where user_id = auth.uid()
      and list_slug is not distinct from left(p_list, 80)
      and created_at > now() - interval '5 seconds'
  ) then
    return;
  end if;
  insert into public.print_events (user_id, list_slug, source, blank)
  values (auth.uid(), left(p_list, 80), p_source, coalesce(p_blank, false));
end;
$$;

revoke all on function public.record_print(text, text, boolean) from public, anon;
grant execute on function public.record_print(text, text, boolean) to authenticated;

-- First purchase date, the end of the 3-day refund window, and the first print for the signed-in account.
create or replace function public.my_refund_window()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'first_paid_at', fp.at,
    'refundable_until', fp.at + interval '3 days',
    'printed_at', (select min(pe.created_at) from public.print_events pe where pe.user_id = auth.uid())
  )
  from (
    select min(coalesce(p.completed_at, p.created_at)) as at
    from public.purchases p
    where p.user_id = auth.uid() and p.payment_status in ('completed', 'refunded')
  ) fp;
$$;

revoke all on function public.my_refund_window() from public, anon;
grant execute on function public.my_refund_window() to authenticated;

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  name text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'refunded', 'denied')),
  refunded_cents integer,
  paypal_refund_ids text[] not null default '{}',
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists refund_requests_status_idx on public.refund_requests (status, created_at desc);

alter table public.refund_requests enable row level security;

drop policy if exists "refund requests readable by owner" on public.refund_requests;
create policy "refund requests readable by owner" on public.refund_requests
  for select using (public.is_owner());

-- A refunded subscription keeps its access ended even when later PayPal syncs report a paid period.
alter table public.subscriptions add column if not exists refunded_at timestamptz;

-- Removes the Survival Vault a purchase granted, unless another paid source still grants it.
-- p_mark_refunded is false when only the Vault part of a larger purchase was refunded.
create or replace function public.revoke_refunded_purchase(p_purchase_id uuid, p_mark_refunded boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.purchases%rowtype;
begin
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found then
    return;
  end if;

  if p_mark_refunded then
    update public.purchases set payment_status = 'refunded' where id = p_purchase_id;
  end if;
  if v_p.user_id is null then
    return;
  end if;

  delete from public.account_entitlements
  where source_purchase_id = p_purchase_id and entitlement in ('full', 'video_vault');

  if not exists (
    select 1
    from public.account_entitlements e
    left join public.purchases p on p.id = e.source_purchase_id
    where e.user_id = v_p.user_id
      and e.entitlement = 'full'
      and e.source_purchase_id is distinct from p_purchase_id
      and (e.source_purchase_id is null or p.payment_status = 'completed')
  ) then
    update public.profiles set plan = 'core' where id = v_p.user_id and plan = 'full';
    update public.plan_groups set has_shared_household = false where created_by = v_p.user_id;
  end if;
end;
$$;

revoke all on function public.revoke_refunded_purchase(uuid, boolean) from public, anon, authenticated;

commit;
