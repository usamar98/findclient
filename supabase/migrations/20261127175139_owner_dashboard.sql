begin;

-- Billing geography is a snapshot on a specific payment. It is kept separate
-- from purchases because customers have an existing SELECT grant on that table.
create table public.purchase_billing_locations (
  stripe_session_id text primary key references public.purchases(stripe_session_id) on delete cascade,
  city text check (length(city) between 1 and 160),
  country text check (country ~ '^[A-Z]{2}$'),
  check (city is not null or country is not null)
);
alter table public.purchase_billing_locations enable row level security;
revoke all on public.purchase_billing_locations from public, anon, authenticated, service_role;
grant select, insert, update on public.purchase_billing_locations to service_role;

create function public.record_purchase_location(p_receipt text, p_city text, p_country text)
returns void language sql security invoker set search_path = '' as $$
  insert into public.purchase_billing_locations as existing (stripe_session_id, city, country)
    select p_receipt, city, country from (
      select nullif(left(btrim(p_city), 160), '') as city,
        case when upper(btrim(p_country)) ~ '^[A-Z]{2}$' then upper(btrim(p_country)) end as country
    ) snapshot
    where city is not null or country is not null
  on conflict (stripe_session_id) do update
    set city = coalesce(existing.city, excluded.city), country = coalesce(existing.country, excluded.country)
    where (existing.city is null or excluded.city is null or lower(existing.city) = lower(excluded.city))
      and (existing.country is null or excluded.country is null or existing.country = excluded.country)
      and ((existing.city is null and excluded.city is not null)
        or (existing.country is null and excluded.country is not null));
$$;
revoke all on function public.record_purchase_location(text,text,text) from public, anon, authenticated;
grant execute on function public.record_purchase_location(text,text,text) to service_role;

create index purchases_created_at_id on public.purchases(created_at desc, id desc);
create index scan_runs_started_at on public.scan_runs(started_at);

-- The service-only public wrapper allows one fixed projection of auth.users
-- without granting the API role general read privileges on the auth schema.
create function private.owner_report(p_days integer, p_search text, p_user_page integer, p_purchase_page integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - make_interval(days => case when p_days in (7,30,90) then p_days else 30 end);
  term text := lower(left(btrim(coalesce(p_search, '')), 320));
  user_offset bigint := (greatest(p_user_page, 1)::bigint - 1) * 20;
  purchase_offset bigint := (greatest(p_purchase_page, 1)::bigint - 1) * 20;
begin
  return (
    with cohort as (
      select u.id from auth.users u where u.created_at >= cutoff and u.deleted_at is null
    ), recent_sales as (
      select p.user_id, p.stripe_session_id, p.product, p.amount
      from public.purchases p where p.created_at >= cutoff
    ), accounts as not materialized (
      select u.id, u.email, u.created_at, u.last_sign_in_at from auth.users u
      where u.deleted_at is null and (term = '' or strpos(lower(u.email), term) > 0 or u.id::text = term)
    ), account_page as (
      select a.id, a.email, a.created_at as "createdAt", a.last_sign_in_at as "lastSignInAt", p.plan,
        exists(select 1 from public.leads l where l.user_id = a.id) as "hasLead"
      from (select * from accounts order by created_at desc, id desc limit 20 offset user_offset) a
      left join public.profiles p on p.id = a.id
    ), sales as not materialized (
      select p.id, u.email, p.created_at, p.product, p.amount, p.stripe_session_id
      from public.purchases p left join auth.users u on u.id = p.user_id and u.deleted_at is null
      where term = '' or strpos(lower(u.email), term) > 0 or p.user_id::text = term
    ), sale_page as (
      select s.id, s.email, s.created_at as "createdAt", s.product, s.amount as "amountCents", l.city, l.country
      from (select * from sales order by created_at desc, id desc limit 20 offset purchase_offset) s
      left join public.purchase_billing_locations l on l.stripe_session_id = s.stripe_session_id
    ), source_counts as (
      select s.source, sum(s.found) as found, sum(s.scored) as scored, sum(s.matched) as matched,
        count(*) filter (where starts_with(s.state, 'failed_')
          or s.state in ('expired', 'missing_exa', 'missing_scorer', 'upgrade_required')) as failed
      from public.scan_runs r join public.scan_run_sources s on s.run_id = r.id
      where r.started_at >= cutoff group by s.source
    ), top_cities as (
      select min(l.city) as city, l.country, count(*) as purchases
      from recent_sales p left join public.purchase_billing_locations l on l.stripe_session_id = p.stripe_session_id
      group by lower(l.city), l.country order by purchases desc, city nulls last, l.country nulls last limit 10
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'signups', (select count(*) from cohort),
        'activated', (select count(*) from cohort c where exists(select 1 from public.leads l where l.user_id = c.id)),
        'buyers', (select count(distinct user_id) from recent_sales where product in ('lifetime','agency','monthly')),
        'grossCents', (select coalesce(sum(amount), 0) from recent_sales)
      ),
      'users', jsonb_build_object(
        'total', (select count(*) from accounts),
        'rows', coalesce((select jsonb_agg(to_jsonb(a) order by a."createdAt" desc, a.id desc) from account_page a), '[]'::jsonb)
      ),
      'purchases', jsonb_build_object(
        'total', (select count(*) from sales),
        'rows', coalesce((select jsonb_agg(to_jsonb(s) order by s."createdAt" desc, s.id desc) from sale_page s), '[]'::jsonb)
      ),
      'sources', coalesce((select jsonb_agg(to_jsonb(s) order by s.matched desc, s.found desc, s.source) from source_counts s), '[]'::jsonb),
      'cities', coalesce((select jsonb_agg(to_jsonb(c) order by c.purchases desc, c.city nulls last, c.country nulls last) from top_cities c), '[]'::jsonb)
    )
  );
end $$;

create function public.owner_report(p_days integer, p_search text, p_user_page integer, p_purchase_page integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.owner_report(p_days, p_search, p_user_page, p_purchase_page);
$$;
revoke all on function private.owner_report(integer,text,integer,integer),
  public.owner_report(integer,text,integer,integer) from public, anon, authenticated;
grant execute on function private.owner_report(integer,text,integer,integer),
  public.owner_report(integer,text,integer,integer) to service_role;

commit;
