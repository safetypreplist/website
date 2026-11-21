-- Temporary Group Sharing: license-based sync (no customer accounts required).
-- Service role only: RLS enabled with no policies.

create table if not exists public.sharing_groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  host_license_id uuid not null references public.licenses (id) on delete cascade,
  max_devices int not null check (max_devices between 2 and 4),
  duration_days int not null check (duration_days in (7, 14, 30)),
  expires_at timestamptz,
  status text not null default 'pending_setup'
    check (status in ('pending_setup', 'active', 'ended', 'expired')),
  stripe_session_id text unique,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists sharing_groups_host_idx on public.sharing_groups (host_license_id);
create index if not exists sharing_groups_status_expires_idx on public.sharing_groups (status, expires_at);

create table if not exists public.sharing_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.sharing_groups (id) on delete cascade,
  license_id uuid references public.licenses (id) on delete set null,
  role text not null check (role in ('host', 'member')),
  permission text not null default 'view' check (permission in ('view', 'edit')),
  permission_accepted boolean not null default false,
  invite_status text not null default 'pending'
    check (invite_status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  invited_email text,
  invited_license_key text,
  invite_token_hash text,
  display_name text,
  invite_sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sharing_group_members_group_idx on public.sharing_group_members (group_id);
create index if not exists sharing_group_members_license_idx on public.sharing_group_members (license_id);
create index if not exists sharing_group_members_token_idx on public.sharing_group_members (invite_token_hash);
create unique index if not exists sharing_group_members_one_host
  on public.sharing_group_members (group_id)
  where role = 'host';
create unique index if not exists sharing_group_members_license_once
  on public.sharing_group_members (group_id, license_id)
  where license_id is not null and invite_status = 'accepted';

-- Temporary synced checklist progress for an active group (cleaned on end/expire).
create table if not exists public.sharing_group_items (
  group_id uuid not null references public.sharing_groups (id) on delete cascade,
  owner_license_id uuid not null references public.licenses (id) on delete cascade,
  checklist_item_id text not null,
  checked boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (group_id, owner_license_id, checklist_item_id)
);

create table if not exists public.sharing_group_custom_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.sharing_groups (id) on delete cascade,
  owner_license_id uuid not null references public.licenses (id) on delete cascade,
  section_id text not null,
  text text not null,
  description text,
  sort_order bigint not null default 0,
  checked boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists sharing_group_custom_items_owner_idx
  on public.sharing_group_custom_items (group_id, owner_license_id);

alter table public.sharing_groups enable row level security;
alter table public.sharing_group_members enable row level security;
alter table public.sharing_group_items enable row level security;
alter table public.sharing_group_custom_items enable row level security;

-- No policies: anon/authenticated cannot read or write. Edge Functions use service role.

comment on table public.sharing_groups is 'Optional paid temporary Group Sharing sessions (license-based).';
comment on table public.sharing_group_members is 'Host and invited licensed members; invite must be accepted on matching activated device.';
comment on table public.sharing_group_items is 'Temporary synced checklist progress; deleted when group ends or expires.';
comment on table public.sharing_group_custom_items is 'Temporary synced custom items; deleted when group ends or expires.';

-- Allow group_sharing payment rows on the host license (historical basic_additional kept).
alter table public.license_payments drop constraint if exists license_payments_checkout_product_check;
alter table public.license_payments
  add constraint license_payments_checkout_product_check
  check (checkout_product in ('basic', 'pro', 'basic_additional', 'upgrade_to_pro', 'group_sharing'));
