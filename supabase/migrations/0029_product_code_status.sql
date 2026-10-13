-- Lets the Create Account page tell a customer when a confirmation number is
-- already linked to another account, instead of silently creating an account
-- with no plan.

create or replace function public.product_code_status(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null then 'unknown'
    when p.user_id is not null then 'claimed'
    when p.payment_status <> 'completed' then 'pending'
    else 'available'
  end
  from (select 1) as one
  left join public.purchases p on p.product_code = upper(btrim(coalesce(p_code, '')))
  limit 1;
$$;

grant execute on function public.product_code_status(text) to anon, authenticated;
