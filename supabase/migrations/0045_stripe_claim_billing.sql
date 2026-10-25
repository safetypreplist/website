-- Attach Stripe subscriptions to the account that claims the confirmation number,
-- and show those payments in Billing & payments.

begin;

create or replace function public.link_purchase_subscription(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.purchases%rowtype;
  v_s public.subscriptions%rowtype;
begin
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found or v_p.user_id is null then
    return;
  end if;

  select * into v_s
  from public.subscriptions
  where purchase_id = v_p.id
     or (v_p.stripe_subscription_id is not null and stripe_subscription_id = v_p.stripe_subscription_id)
     or (v_p.stripe_checkout_session_id is not null and stripe_checkout_session_id = v_p.stripe_checkout_session_id)
     or (v_p.paypal_subscription_id is not null and paypal_subscription_id = v_p.paypal_subscription_id)
  order by created_at desc
  limit 1;
  if not found then
    return;
  end if;

  update public.subscriptions
  set user_id = v_p.user_id, purchase_id = v_p.id, updated_at = now()
  where id = v_s.id;

  if v_s.purpose = 'renew' then
    update public.personal_checklists
    set subscription_id = v_s.id
    where status <> 'cancelled'
      and subscription_id in (
        select id from public.subscriptions
        where user_id = v_p.user_id and id <> v_s.id and status in ('cancelled', 'expired', 'suspended')
      );
  else
    update public.personal_checklists
    set subscription_id = v_s.id
    where subscription_id is null
      and (owner_user_id = v_p.user_id or purchased_by_user_id = v_p.user_id);
  end if;

  perform public.sync_subscription_access(v_s.id);
end;
$$;

update public.subscriptions s
set user_id = p.user_id,
    purchase_id = coalesce(s.purchase_id, p.id),
    updated_at = now()
from public.purchases p
where p.user_id is not null
  and (
    s.purchase_id = p.id
    or (p.stripe_subscription_id is not null and s.stripe_subscription_id = p.stripe_subscription_id)
    or (p.stripe_checkout_session_id is not null and s.stripe_checkout_session_id = p.stripe_checkout_session_id)
  )
  and (s.user_id is distinct from p.user_id or s.purchase_id is distinct from p.id);

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
    where s.status <> 'approval_pending'
      and (
        s.user_id = me.id
        or s.purchase_id in (select id from public.purchases where user_id = me.id)
      )
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
      and not exists (
        select 1 from public.subscriptions s
        where s.purchase_id = p.id or s.stripe_checkout_session_id = p.stripe_checkout_session_id
      )
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

revoke all on function public.link_purchase_subscription(uuid) from public, anon, authenticated;
revoke all on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated;

commit;
