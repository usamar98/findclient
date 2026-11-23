alter table public.profiles drop constraint profiles_plan_check;
alter table public.profiles add check (plan in ('free','monthly','lifetime','agency'));

alter table public.product_config add column sale_ends_at timestamptz;
update public.product_config set price_cents = 14900,
  sale_ends_at = '2026-12-27 00:00:00+05' where product = 'lifetime';
insert into public.product_config (product, price_cents, credits) values ('monthly', 4900, 150);

alter table public.checkout_quotes add column stripe_subscription_id text unique,
  add column subscription_ended boolean not null default false,
  add column paid_through timestamptz;

create or replace function public.lifetime_price()
returns table(sales int, price int, spots int) language sql stable as $$
  with totals as (select count(*)::int as n from public.purchases where product='lifetime')
  select n, c.price_cents / 100 + 10 * (n / 10), 10 - n % 10
  from totals, public.product_config c where c.product='lifetime'
$$;

create or replace function public.create_quote(p_user uuid, p_product text)
returns public.checkout_quotes language plpgsql as $$
declare
  item public.product_config;
  result public.checkout_quotes;
  tier record;
  current_plan text;
begin
  if p_product='agency' then raise exception 'Offer retired'; end if;
  select plan into strict current_plan from public.profiles where id=p_user for update;
  select * into strict item from public.product_config where product=p_product for update;
  if item.sale_ends_at <= now() then raise exception 'Offer ended'; end if;
  if p_product in ('lifetime','monthly') then
    if current_plan <> 'free' then raise exception 'Plan already owned'; end if;
    if exists(select 1 from public.checkout_quotes where user_id=p_user
        and product in ('agency','lifetime','monthly') and
        (state='open' or (product='monthly' and state='paid' and not subscription_ended))) then
      raise exception 'An existing plan or checkout is open';
    end if;
  end if;
  if p_product='lifetime' then
    select * into tier from public.lifetime_price();
    if (select count(*) from public.checkout_quotes where product='lifetime'
        and state='open' and amount=tier.price*100) >= tier.spots then
      raise exception 'Remaining spots are currently in checkout';
    end if;
    item.price_cents = tier.price * 100;
  end if;
  insert into public.checkout_quotes (user_id,product,amount,credits,expires_at)
    values(p_user,p_product,item.price_cents,item.credits,now()+interval '35 minutes')
    returning * into result;
  return result;
end $$;

-- Each initial or renewal invoice is the unique financial event for a monthly refill.
-- A cancellation can arrive before its corresponding invoice webhook.
create function public.apply_subscription_invoice(p_quote uuid, p_invoice text,
  p_subscription text, p_customer text, p_amount int, p_period_end timestamptz)
returns boolean language plpgsql as $$
declare
  q public.checkout_quotes;
  owner_id uuid;
begin
  select user_id into strict owner_id from public.checkout_quotes where id=p_quote;
  perform 1 from public.profiles where id=owner_id and stripe_customer_id=p_customer for update;
  if not found then raise exception 'Subscription customer mismatch'; end if;
  select * into strict q from public.checkout_quotes where id=p_quote for update;
  if q.product <> 'monthly' or q.amount <> p_amount or
      (q.stripe_subscription_id is not null and q.stripe_subscription_id <> p_subscription) then
    raise exception 'Subscription invoice mismatch';
  end if;
  insert into public.purchases (user_id,stripe_session_id,product,amount)
    values(owner_id,p_invoice,'monthly',p_amount)
    on conflict(stripe_session_id) do nothing;
  if not found then return false; end if;
  update public.checkout_quotes set state='paid', stripe_subscription_id=p_subscription,
    paid_through=greatest(paid_through,p_period_end) where id=p_quote;
  update public.profiles set credits=credits+q.credits,
    plan=case when plan='free' and not q.subscription_ended and p_period_end>now()
      then 'monthly' else plan end where id=owner_id;
  insert into public.notifications(user_id,kind,event_key,payload)
    values(owner_id,'receipt','receipt:'||p_invoice,jsonb_build_object('product','monthly','amount',p_amount));
  return true;
end $$;

create function public.end_subscription(p_quote uuid,p_subscription text,p_customer text)
returns void language plpgsql as $$
declare owner_id uuid;
begin
  select user_id into strict owner_id from public.checkout_quotes where id=p_quote;
  perform 1 from public.profiles where id=owner_id and stripe_customer_id=p_customer for update;
  if not found then raise exception 'Subscription customer mismatch'; end if;
  update public.checkout_quotes set subscription_ended=true, stripe_subscription_id=p_subscription,
    state=case when state='open' then 'expired' else state end
    where id=p_quote and product='monthly' and
      (stripe_subscription_id is null or stripe_subscription_id=p_subscription);
  if not found then raise exception 'Subscription mismatch'; end if;
  update public.profiles set plan='free' where id=owner_id and plan='monthly' and not exists(
    select 1 from public.checkout_quotes where user_id=owner_id and product='monthly'
      and not subscription_ended and paid_through>now()
  );
end $$;

revoke execute on function public.apply_subscription_invoice(uuid,text,text,text,int,timestamptz),
  public.end_subscription(uuid,text,text) from public, anon, authenticated;
grant execute on function public.apply_subscription_invoice(uuid,text,text,text,int,timestamptz),
  public.end_subscription(uuid,text,text) to service_role;

-- A failed renewal adds no credits. When the paid period passes, active access
-- expires until another invoice is paid. Older lifetime accounts keep their refills.
alter function public.refill_credits() set schema private;
create function public.refill_credits() returns void language plpgsql as $$
begin
  perform private.refill_credits();
  update public.profiles p set plan='free' where plan='monthly' and not exists (
    select 1 from public.checkout_quotes q where q.user_id=p.id and q.product='monthly'
      and not q.subscription_ended and q.paid_through>now()
  );
end $$;
grant usage on schema private to service_role;
revoke execute on function public.refill_credits() from public, anon, authenticated;
grant execute on function public.refill_credits() to service_role;
