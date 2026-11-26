begin;

-- Shared between workspaces. Only server-side collectors and readers have access.
create table public.shared_hiring_jobs (
  source text not null check (source in ('hn','bluesky','weworkremotely','remoteok','github','mastodon')),
  source_key text not null,
  url text not null check (url like 'https://%'),
  posted_at timestamptz not null,
  first_found_at timestamptz not null default statement_timestamp(),
  listing jsonb,
  primary key (source, source_key)
);
create index shared_hiring_recent on public.shared_hiring_jobs (source, posted_at desc, source_key);
create index shared_hiring_retention on public.shared_hiring_jobs (posted_at);

create table public.shared_hiring_sources (
  source text primary key check (source in ('hn','bluesky')),
  status text not null default 'unavailable' check (status in ('checked','cooldown','access','unavailable')),
  partial boolean not null default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  next_check_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz
);
insert into public.shared_hiring_sources (source) values ('hn'), ('bluesky');

alter table public.shared_hiring_jobs enable row level security;
alter table public.shared_hiring_sources enable row level security;
revoke all on public.shared_hiring_jobs, public.shared_hiring_sources from public, anon, authenticated, service_role;
grant select, delete, insert (source, source_key, url, posted_at, listing), update (url, listing)
  on public.shared_hiring_jobs to service_role;
grant select, update on public.shared_hiring_sources to service_role;

-- Set the first observation in Postgres. Clients cannot replace it on a repeat observation.
create function public.record_job_discoveries(p_jobs jsonb)
returns table (source text, url text, first_found_at timestamptz)
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(p_jobs) <> 'array' or jsonb_array_length(p_jobs) > 1000 then
    raise exception 'Invalid hiring batch';
  end if;
  insert into public.shared_hiring_jobs as job (source, source_key, url, posted_at, listing)
  select distinct on (j.source, j.source_key) j.source, j.source_key, j.url, j.posted_at, j.listing
  from jsonb_to_recordset(p_jobs) as j(source text, source_key text, url text, posted_at timestamptz, listing jsonb)
  where j.posted_at between statement_timestamp() - interval '24 hours' and statement_timestamp()
  order by j.source, j.source_key, j.posted_at
  on conflict on constraint shared_hiring_jobs_pkey do update
    set url = excluded.url, listing = excluded.listing
    where (job.url, job.listing) is distinct from (excluded.url, excluded.listing);

  return query
  select job.source, job.url, job.first_found_at
  from jsonb_to_recordset(p_jobs) as j(source text, source_key text)
  join public.shared_hiring_jobs job on (job.source, job.source_key) = (j.source, j.source_key);
end;
$$;

-- A page load and a cron tick can arrive together. Only one caller polls each source.
create function public.claim_shared_hiring_sources(p_sources text[])
returns table (source text, lease_id uuid)
language sql set search_path = '' as $$
  with due as (
    select s.source from public.shared_hiring_sources s
    where s.source = any(p_sources) and s.next_check_at <= now()
      and (s.lease_until is null or s.lease_until <= now())
      and not exists (select 1 from public.source_backoffs b where b.source=s.source and b.retry_at>now())
    order by s.source for update skip locked
  )
  update public.shared_hiring_sources s
  set lease_id = gen_random_uuid(), lease_until = now() + interval '90 seconds',
      next_check_at = date_trunc('minute', now()) + interval '1 minute'
  from due where due.source = s.source returning s.source, s.lease_id;
$$;

create function public.complete_shared_hiring_source(
  p_source text, p_lease uuid, p_status text, p_partial boolean, p_retry_at timestamptz, p_jobs jsonb,
  p_withdrawn text[] default '{}'
) returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from public.shared_hiring_sources
    where source = p_source and lease_id = p_lease and lease_until > now() for update;
  if not found then return false; end if;
  if exists (select 1 from jsonb_array_elements(p_jobs) j where (j->>'source') is distinct from p_source) then
    raise exception 'Mixed-source hiring batch';
  end if;
  if p_status = 'checked' then
    perform public.record_job_discoveries(p_jobs);
    -- Keep the immutable observation for a re-opened job, strip withdrawn content.
    update public.shared_hiring_jobs set listing = null
      where source = p_source and source_key = any(p_withdrawn) and listing is not null;
  end if;
  if p_retry_at > now() then perform public.defer_source(p_source, p_retry_at); end if;
  update public.shared_hiring_sources
    set status = p_status, partial = p_partial, last_checked_at = now(),
        last_success_at = case when p_status = 'checked' then now() else last_success_at end,
        next_check_at = greatest(next_check_at, p_retry_at), lease_until = null, lease_id = null
    where source = p_source;
  return true;
end;
$$;

revoke all on function public.record_job_discoveries(jsonb), public.claim_shared_hiring_sources(text[]),
  public.complete_shared_hiring_source(text,uuid,text,boolean,timestamptz,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.record_job_discoveries(jsonb), public.claim_shared_hiring_sources(text[]),
  public.complete_shared_hiring_source(text,uuid,text,boolean,timestamptz,jsonb,text[]) to service_role;

commit;
