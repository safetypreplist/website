-- One-time lifetime licenses (no customer accounts).
-- Service role only: RLS enabled with no policies.

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text not null unique,
  product text not null check (product in ('basic', 'pro')),
  devices_allowed int not null default 2,
  status text not null default 'active' check (status in ('active', 'revoked')),
  email text,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.license_devices (
  license_id uuid not null references public.licenses (id) on delete cascade,
  device_id text not null,
  activated_at timestamptz not null default now(),
  primary key (license_id, device_id)
);

create index if not exists licenses_email_idx on public.licenses (lower(email));
create index if not exists license_devices_device_id_idx on public.license_devices (device_id);

alter table public.licenses enable row level security;
alter table public.license_devices enable row level security;

-- No policies: anon/authenticated cannot read or write. Service role bypasses RLS.

comment on table public.licenses is 'One-time Basic/Pro license keys issued after Stripe Checkout.';
comment on table public.license_devices is 'Devices activated against a license (max devices_allowed).';
