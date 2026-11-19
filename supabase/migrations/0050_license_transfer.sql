-- Temporary transfer backups + email-confirmed deactivation tokens (48h).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'license-transfers',
  'license-transfers',
  false,
  1500000,
  array['application/json']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 1500000,
    allowed_mime_types = array['application/json']::text[];

-- No public/authenticated policies: service role only via edge functions.
drop policy if exists "license transfers public read" on storage.objects;

create table if not exists public.license_deactivation_tokens (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  request_ip text
);

create index if not exists license_deactivation_tokens_license_idx
  on public.license_deactivation_tokens (license_id, created_at desc);

create table if not exists public.license_transfer_backups (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  storage_path text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 1500000),
  checksum text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_from_device_id text,
  deleted_at timestamptz
);

create index if not exists license_transfer_backups_license_idx
  on public.license_transfer_backups (license_id, created_at desc)
  where deleted_at is null;

alter table public.license_deactivation_tokens enable row level security;
alter table public.license_transfer_backups enable row level security;
