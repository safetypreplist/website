-- Stripe Checkout + Billing IDs alongside existing PayPal columns (legacy rows stay valid).

begin;

alter table public.profiles
  add column if not exists stripe_customer_id text;
create unique index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

alter table public.subscriptions
  alter column paypal_subscription_id drop not null,
  alter column paypal_plan_id drop not null;
alter table public.subscriptions
  add column if not exists provider text not null default 'paypal',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_price_id text;
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('paypal', 'stripe'));
create unique index if not exists subscriptions_stripe_session_idx
  on public.subscriptions (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.purchases
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_invoice_id text;
create unique index if not exists purchases_stripe_session_idx
  on public.purchases (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists purchases_stripe_subscription_idx
  on public.purchases (stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.subscription_payments
  alter column paypal_sale_id drop not null;
alter table public.subscription_payments
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_payment_intent_id text;
create unique index if not exists subscription_payments_stripe_invoice_idx
  on public.subscription_payments (stripe_invoice_id) where stripe_invoice_id is not null;

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

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
      coalesce(sp.stripe_invoice_id, sp.paypal_sale_id) as reference,
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
      coalesce(p.stripe_payment_intent_id, p.paypal_capture_id, p.product_code),
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
      and p.stripe_subscription_id is null
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
        'provider', s.provider,
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
