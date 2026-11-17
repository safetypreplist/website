-- Persist what the customer actually paid (Stripe Checkout amount_total).
alter table public.licenses
  add column if not exists amount_cents int;

comment on column public.licenses.amount_cents is 'Amount paid on first Basic/Pro purchase (cents). Not overwritten on upgrade.';
