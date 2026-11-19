-- Append-only purchase history for lifetime licenses (Stripe checkout as source of truth).

create table if not exists public.license_payments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses (id) on delete cascade,
  stripe_session_id text not null,
  payment_intent_id text,
  checkout_product text not null
    check (checkout_product in ('basic', 'pro', 'basic_additional', 'upgrade_to_pro')),
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  tax_cents integer,
  currency text not null default 'usd',
  payment_method_summary text,
  receipt_url text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (license_id, stripe_session_id)
);

create index if not exists license_payments_license_idx
  on public.license_payments (license_id, paid_at desc);

create index if not exists license_payments_session_idx
  on public.license_payments (stripe_session_id);

alter table public.license_payments enable row level security;

comment on table public.license_payments is
  'Chronological purchase records for a lifetime license. Original Basic purchase is preserved when upgrading to Pro.';
