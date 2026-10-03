insert into public.app_config (key, value)
values (
  'help_faqs',
  '[
    {"id":"check","question":"How do I check items off?","answer":"Open a list and tap the circle next to an item. Checked items turn gray and italic so you can see what is already done."},
    {"id":"notes","question":"How do I add a note?","answer":"On any item, tap Add note to leave a reminder for yourself — for example, where something is stored or what size to buy."},
    {"id":"family","question":"How do I add family members?","answer":"Go to Manage Family Plan to invite someone new or connect an existing checklist so you can prepare together."},
    {"id":"devices","question":"Why am I asked about devices?","answer":"Each login can stay active on a limited number of devices. Remove an old one from My Devices if you need a free slot."},
    {"id":"tour","question":"Can I see the guided tour again?","answer":"Yes. Use Replay the guided tour on the Help page anytime you want a walkthrough of the app."}
  ]'::jsonb
)
on conflict (key) do nothing;

create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  name text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.help_requests enable row level security;

drop policy if exists "help insert own" on public.help_requests;
create policy "help insert own" on public.help_requests
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "help read own" on public.help_requests;
create policy "help read own" on public.help_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
