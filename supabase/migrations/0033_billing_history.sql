-- Billing history: failed and refunded subscription charges, and a per-account billing summary.

begin;

alter table public.subscription_payments
  add column if not exists status text not null default 'completed',
  add column if not exists failure_reason text;
alter table public.subscription_payments drop constraint if exists subscription_payments_status_check;
alter table public.subscription_payments
  add constraint subscription_payments_status_check check (status in ('completed', 'failed', 'refunded'));

create or replace function public.my_billing()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ),
  subs as (
    select s.*
    from public.subscriptions s, me
    where s.user_id = me.id and s.status <> 'approval_pending'
  ),
  first_sale as (
    select sp.subscription_id, min(sp.paid_at) as paid_at
    from public.subscription_payments sp
    join subs s on s.id = sp.subscription_id
    where sp.status <> 'failed'
    group by sp.subscription_id
  ),
  charges as (
    select
      'sp:' || sp.id::text as id,
      sp.paid_at as at,
      sp.amount_cents,
      sp.status,
      sp.failure_reason,
      sp.paypal_sale_id as reference,
      case
        when s.vault_cents > 0 and sp.amount_cents = s.vault_cents and sp.paid_at = fs.paid_at then 'vault'
        else 'plan'
      end as kind,
      s.purpose,
      s.quantity,
      s.access_interval,
      p.product_code
    from public.subscription_payments sp
    join subs s on s.id = sp.subscription_id
    left join first_sale fs on fs.subscription_id = s.id
    left join public.purchases p on p.id = s.purchase_id
    union all
    -- PayPal reports each charge by webhook; until it does, the order itself stands in for the first payment.
    select
      'pu:' || p.id::text,
      coalesce(p.completed_at, p.created_at),
      p.amount_cents,
      p.payment_status::text,
      null,
      p.product_code,
      case when s.vault_cents > 0 then 'plan_vault' else 'plan' end,
      s.purpose,
      s.quantity,
      s.access_interval,
      p.product_code
    from subs s
    join public.purchases p on p.id = s.purchase_id
    where not exists (
      select 1 from public.subscription_payments sp
      where sp.subscription_id = s.id and sp.status <> 'failed'
    )
    union all
    select
      'pu:' || p.id::text,
      coalesce(p.completed_at, p.created_at),
      p.amount_cents,
      p.payment_status::text,
      null,
      coalesce(p.paypal_capture_id, p.product_code),
      case
        when p.product_type::text = 'upgrade_full' then 'vault'
        when p.product_type::text = 'extra_device' then 'device'
        when p.product_type::text = 'extra_items' then 'items'
        when p.includes_household then 'plan_vault'
        else 'plan'
      end,
      'one_time',
      coalesce(p.quantity, 1),
      p.access_interval,
      p.product_code
    from public.purchases p, me
    where p.user_id = me.id
      and p.paypal_subscription_id is null
      and p.payment_status::text in ('completed', 'refunded')
  )
  select jsonb_build_object(
    'payments', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.at desc) from charges c
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'purpose', s.purpose,
        'status', s.status,
        'quantity', s.quantity,
        'access_interval', s.access_interval,
        'regular_cents', s.regular_cents,
        'discount_cents', s.discount_cents,
        'discount_payments', s.discount_payments,
        'paid_cycles', (
          select count(*) from public.subscription_payments sp
          where sp.subscription_id = s.id and sp.status = 'completed'
            and not (s.vault_cents > 0 and sp.amount_cents = s.vault_cents
              and sp.paid_at = (select fs.paid_at from first_sale fs where fs.subscription_id = s.id))
        ),
        'paid_through', s.paid_through,
        'access_ends_at', s.access_ends_at,
        'created_at', s.created_at
      ) order by s.created_at)
      from subs s
      where s.status in ('active', 'suspended')
        or (s.status = 'cancelled' and s.access_ends_at > now())
    ), '[]'::jsonb),
    'payer_email', (
      select p.payer_email from public.purchases p, me
      where p.user_id = me.id and p.payer_email is not null
      order by p.created_at desc
      limit 1
    )
  );
$$;

revoke all on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated;

commit;
