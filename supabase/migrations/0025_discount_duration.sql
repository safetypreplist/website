-- How many subscription payments a code discounts once a customer subscribes (1 = first payment only).
alter table public.discount_codes
  add column if not exists discount_payments integer not null default 1 check (discount_payments >= 1);

comment on column public.discount_codes.discount_payments is 'Number of subscription payments that get the discount, starting with the first. 1 = first payment only.';

alter table public.purchases
  add column if not exists discount_payments integer check (discount_payments is null or discount_payments >= 1);

comment on column public.purchases.discount_payments is 'Copied from the code at checkout. Renewals inside this count keep the discounted subscription price.';
