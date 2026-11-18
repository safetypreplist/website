-- One license covers exactly one device. Additional devices need another license.

alter table public.licenses
  alter column devices_allowed set default 1;

update public.licenses
set devices_allowed = 1
where devices_allowed is distinct from 1;

-- Drop prior open-ended check if present, then require exactly 1.
alter table public.licenses drop constraint if exists licenses_devices_allowed_check;
alter table public.licenses
  add constraint licenses_devices_allowed_check check (devices_allowed = 1);

alter table public.licenses
  add column if not exists last_deactivated_at timestamptz;

alter table public.licenses
  add column if not exists linked_to text;

comment on column public.licenses.last_deactivated_at is 'Last successful self-service deactivate; limited to once per 30 days.';
comment on column public.licenses.linked_to is 'For additional Basic licenses: purchaser email this key is linked to.';
comment on table public.license_devices is 'At most one active device per license (devices_allowed = 1).';
