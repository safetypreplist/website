-- Owner-managed checkout codes. Amounts are applied in Edge Functions, never in the browser.
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null check (value > 0),
  applies_to text not null default 'all' check (applies_to in ('all', 'individual', 'family')),
  active boolean not null default true,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.discount_codes.value is 'Percent off (1-100) or fixed amount in cents. Applies to subscription only, not Survival Vault.';

alter table public.purchases
  add column if not exists discount_code text,
  add column if not exists discount_cents integer not null default 0;

alter table public.discount_codes enable row level security;

drop policy if exists "owners manage discount codes" on public.discount_codes;
create policy "owners manage discount codes"
  on public.discount_codes
  for all
  using (public.is_owner())
  with check (public.is_owner());

insert into public.discount_codes (code, kind, value, applies_to, active, expires_at) values
  ('READY10', 'percent', 10, 'all', true, '2026-10-31T23:59:59Z'),
  ('FAMILY25', 'percent', 25, 'family', true, '2026-12-31T23:59:59Z'),
  ('WELCOME5', 'fixed', 500, 'all', false, '2026-01-01T00:00:00Z')
on conflict (code) do nothing;

insert into public.app_config (key, value) values
  ('onboarding_copy', '[]'::jsonb)
on conflict (key) do nothing;

create or replace function public.increment_discount_redemption(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discount_codes
    set redemption_count = redemption_count + 1,
        updated_at = now()
  where code = upper(trim(p_code));
end;
$$;

revoke all on function public.increment_discount_redemption(text) from public;
grant execute on function public.increment_discount_redemption(text) to service_role;
