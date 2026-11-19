-- Email-based license key recovery (secure link). Service role only.

create table if not exists public.license_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  request_ip text
);

create index if not exists license_recovery_tokens_email_idx
  on public.license_recovery_tokens (email_normalized, created_at desc);

alter table public.license_recovery_tokens enable row level security;

create or replace function public.licenses_for_email(p_email text)
returns setof public.licenses
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.licenses
  where status = 'active'
    and email is not null
    and lower(email) = lower(trim(p_email));
$$;

revoke all on function public.licenses_for_email(text) from public;
revoke all on function public.licenses_for_email(text) from anon, authenticated;
grant execute on function public.licenses_for_email(text) to service_role;

comment on table public.license_recovery_tokens is 'One-time email recovery links for license key retrieval.';
comment on function public.licenses_for_email(text) is 'Service-role lookup of active licenses by purchase email.';
