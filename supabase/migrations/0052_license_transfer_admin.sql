-- Persist deactivate backup decisions + admin support export audit for transfers.

alter table public.license_deactivation_tokens
  add column if not exists backup_decision text
    check (backup_decision is null or backup_decision in ('backed_up', 'skipped', 'unknown')),
  add column if not exists backup_method text
    check (backup_method is null or backup_method in ('cloud', 'file', 'none', 'unknown'));

create table if not exists public.license_support_backup_exports (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses (id) on delete cascade,
  backup_id uuid references public.license_transfer_backups (id) on delete set null,
  exported_by uuid,
  exported_at timestamptz not null default now(),
  assistance_recorded_at timestamptz,
  assistance_note text,
  deleted_at timestamptz,
  request_ip text
);

create index if not exists license_support_backup_exports_license_idx
  on public.license_support_backup_exports (license_id, exported_at desc);

alter table public.license_support_backup_exports enable row level security;

comment on table public.license_support_backup_exports is
  'Audit log for owner-authorized cloud backup exports during customer-requested transfer support. Does not store checklist contents.';
