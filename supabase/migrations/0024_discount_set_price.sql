-- Adds "price" codes: the first subscription payment becomes a set price per checklist.
alter table public.discount_codes drop constraint if exists discount_codes_kind_check;
alter table public.discount_codes
  add constraint discount_codes_kind_check check (kind in ('percent', 'fixed', 'price'));

comment on column public.discount_codes.value is 'Percent off (1-100), fixed amount off in cents, or set first-payment price per checklist in cents. Applies to subscription only, not Survival Vault.';
