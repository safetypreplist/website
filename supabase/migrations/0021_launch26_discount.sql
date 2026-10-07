-- First-charge percent off. Checkout still renews at the regular monthly price.
insert into public.discount_codes (code, kind, value, applies_to, active)
values ('LAUNCH26', 'percent', 50, 'all', true)
on conflict (code) do nothing;
