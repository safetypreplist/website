-- Tawk.to active chat presence for the owner operations console.
create table if not exists public.active_support_chats (
  chat_id text primary key,
  property_id text not null,
  property_name text,
  visitor_name text,
  visitor_email text,
  visitor_city text,
  visitor_country text,
  domain text,
  referrer text,
  first_message text,
  started_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists active_support_chats_started_idx
  on public.active_support_chats (started_at desc);

alter table public.active_support_chats enable row level security;

create policy "owners can view active support chats"
  on public.active_support_chats
  for select
  using (public.is_owner());

alter table public.active_support_chats replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.active_support_chats;
exception
  when duplicate_object then null;
end
$$;
