-- Group Sharing follow-ups: per-invite email delivery status, in-app invite lookup by email,
-- and stable ids for custom items published to a group.

alter table public.sharing_group_members
  add column if not exists invite_email_status text,
  add column if not exists invite_email_error text;

alter table public.sharing_group_members drop constraint if exists sharing_group_members_invite_email_status_check;
alter table public.sharing_group_members
  add constraint sharing_group_members_invite_email_status_check
  check (invite_email_status is null or invite_email_status in ('sent', 'failed', 'not_sent'));

create index if not exists sharing_group_members_pending_email_idx
  on public.sharing_group_members (invited_email)
  where invite_status = 'pending';

create index if not exists sharing_group_members_pending_key_idx
  on public.sharing_group_members (invited_license_key)
  where invite_status = 'pending';

alter table public.sharing_group_custom_items
  add column if not exists client_item_id text;

create unique index if not exists sharing_group_custom_items_client_idx
  on public.sharing_group_custom_items (group_id, owner_license_id, client_item_id)
  where client_item_id is not null;

comment on column public.sharing_group_members.invite_email_status is
  'Outcome of the last invite email: sent, failed (provider error), or not_sent (no address / no provider).';
comment on column public.sharing_group_custom_items.client_item_id is
  'Id of the custom item on the owner''s device, so shared progress rows line up with it.';
