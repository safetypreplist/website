-- Additive legal-consent records. Existing users are prompted on next login.
-- Transaction rows and acceptances are kept after account deletion.

alter table public.profiles
  add column if not exists cancel_requested_at timestamptz;

create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  terms_version text not null,
  privacy_version text not null,
  refund_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  context text not null check (context in ('checkout', 'signup', 'email_signup', 'in_app_ack', 'terms_update'))
);

create index if not exists terms_acceptances_user_idx on public.terms_acceptances (user_id, accepted_at desc);
create index if not exists terms_acceptances_email_idx on public.terms_acceptances (email);

alter table public.terms_acceptances enable row level security;

drop policy if exists "terms_acceptances_select_own" on public.terms_acceptances;
create policy "terms_acceptances_select_own"
  on public.terms_acceptances
  for select
  using (auth.uid() = user_id);

comment on table public.terms_acceptances is
  'Records of Terms, Privacy, and Refund agreement. Kept after account deletion.';
