-- A run groups the source jobs for one saved search. Receipts outlive queue cleanup.
alter table public.profiles add column monthly_reply_reserve integer not null default 0 check (monthly_reply_reserve >= 0);
alter table public.niches add column monthly_score_limit integer check (monthly_score_limit >= 0);

create table public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  niche_id uuid not null references public.niches on delete cascade,
  service text not null,
  started_at timestamptz not null default now(),
  scheduled_for timestamptz,
  credit_limit integer check (credit_limit > 0),
  check ((scheduled_for is null) = (credit_limit is not null)),
  unique(niche_id,scheduled_for)
);
create index scan_runs_owner on public.scan_runs(user_id,started_at desc);
create table public.scan_run_sources (
  job_id uuid primary key,
  run_id uuid not null references public.scan_runs on delete cascade,
  source text not null,
  state text not null default 'queued',
  source_checked boolean not null default false,
  found integer not null default 0,
  scored integer not null default 0,
  matched integer not null default 0,
  spent integer not null default 0,
  retry_at timestamptz,
  unique(run_id,source)
);
alter table public.scan_runs enable row level security;
alter table public.scan_run_sources enable row level security;
revoke all on public.scan_runs,public.scan_run_sources from public,anon,authenticated;
grant select on public.scan_runs,public.scan_run_sources to authenticated;
grant all on public.scan_runs,public.scan_run_sources to service_role;
create policy owner_read on public.scan_runs for select to authenticated using (user_id=(select auth.uid()));
create policy owner_read on public.scan_run_sources for select to authenticated using (
  exists (select 1 from public.scan_runs r where r.id=run_id and r.user_id=(select auth.uid()))
);

alter table public.scan_jobs add column run_id uuid references public.scan_runs on delete cascade,
  add column candidates jsonb, add column outcome text;
create index scan_job_run on public.scan_jobs(run_id) where done_at is null;
alter table public.usage_events add column niche_id uuid references public.niches on delete set null,
  add column source text, add column scan_job_id uuid, add column scan_run_id uuid;
create index scan_spend_by_month on public.usage_events(niche_id,created_at) where type='score';
create index reply_spend_by_month on public.usage_events(user_id,created_at) where type='response';
create index scan_spend_by_run on public.usage_events(scan_run_id) where scan_run_id is not null;

create function private.bind_scheduled_run() returns trigger language plpgsql set search_path='' as $$
begin
  if new.run_id is null then
    -- Before the upgrade a completed slot had no receipt. Its enqueue retry will hit
    -- the existing unique job and must not create a new run with empty metrics.
    if tg_op='INSERT' and exists(select 1 from public.scan_jobs j where j.niche_id=new.niche_id
      and j.source=new.source and j.scan_hour=new.scan_hour) then return new; end if;
    insert into public.scan_runs (user_id,niche_id,service,scheduled_for)
      select n.user_id,n.id,n.skill,new.scan_hour from public.niches n where n.id=new.niche_id
      on conflict (niche_id,scheduled_for) do nothing;
    select id into strict new.run_id from public.scan_runs where niche_id=new.niche_id and scheduled_for=new.scan_hour;
  end if;
  return new;
end $$;
create trigger attach_scan_run before insert or update of run_id on public.scan_jobs
  for each row execute function private.bind_scheduled_run();

create function private.sync_scan_receipt() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.done_at is null then update public.scan_run_sources set state='expired',retry_at=null where job_id=old.id; end if;
    return old;
  end if;
  if new.run_id is null then return new; end if;
  insert into public.scan_run_sources(job_id,run_id,source,state,source_checked,found,retry_at)
    values(new.id,new.run_id,new.source,
      case when new.lease is not null then 'running' when new.outcome is not null then new.outcome
           when new.done_at is not null then 'complete' when new.available_at>now() then 'retrying' else 'queued' end,
      new.candidates is not null,coalesce(jsonb_array_length(new.candidates),0),
      case when new.lease is null and new.done_at is null and new.available_at>now() then new.available_at end)
    on conflict (job_id) do update set state=excluded.state,source_checked=excluded.source_checked or scan_run_sources.source_checked,
      found=greatest(scan_run_sources.found,excluded.found),
      retry_at=excluded.retry_at;
  return new;
end $$;
create trigger record_scan_job after insert or update or delete on public.scan_jobs
  for each row execute function private.sync_scan_receipt();
-- In-flight scheduled jobs receive a receipt when upgrading an existing workspace.
update public.scan_jobs set run_id=null where done_at is null;

create function public.start_manual_scan(p_user uuid,p_niche uuid,p_request uuid,p_limit integer)
returns uuid language plpgsql set search_path='' as $$
declare n public.niches; existing uuid;
begin
  if p_limit is null or p_limit < 1 then raise exception 'Invalid scan limit'; end if;
  perform 1 from public.profiles where id=p_user for update;
  select * into strict n from public.niches where id=p_niche and user_id=p_user;
  select id into existing from public.scan_runs where id=p_request and user_id=p_user and niche_id=p_niche and credit_limit=p_limit;
  if found then return existing; end if;
  select r.id into existing from public.scan_runs r where r.niche_id=p_niche and r.credit_limit is not null
    and exists (select 1 from public.scan_jobs j where j.run_id=r.id and j.done_at is null and j.scan_hour>now()-interval '6 hours')
    order by r.started_at desc limit 1;
  if found then return existing; end if;
  insert into public.scan_runs (id,user_id,niche_id,service,credit_limit) values(p_request,p_user,p_niche,n.skill,p_limit);
  insert into public.scan_jobs(niche_id,source,scan_hour,run_id,available_at)
    select p_niche,s,clock_timestamp(),p_request,greatest(now(),b.retry_at)
    from unnest(n.sources) s left join public.source_backoffs b
      on b.source=case when s in ('reddit','x','indiehackers','forums') then 'exa' else s end;
  return p_request;
end $$;

-- The shared row lock on profiles serializes grants, refunds, manual and scheduled reservations.
-- Pending calls count until they settle or refund. Reply credits consumed this month release that portion of the reserve.
create function public.scan_allowance(p_run uuid)
returns integer language sql stable set search_path='' as $$
  with period as (select date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' as start_at)
  select greatest(0,least(
    p.credits-greatest(0,p.monthly_reply_reserve-coalesce((
      select sum(cost_credits) from public.usage_events u where u.user_id=p.id and u.type='response' and u.created_at>=period.start_at
    ),0)),
    n.monthly_score_limit-coalesce((
      select sum(cost_credits) from public.usage_events u where u.niche_id=n.id and u.type='score' and u.created_at>=period.start_at
    ),0),
    r.credit_limit-coalesce((select sum(cost_credits) from public.usage_events u where u.scan_run_id=r.id),0)
  ))::integer
  from public.scan_runs r join public.niches n on n.id=r.niche_id join public.profiles p on p.id=r.user_id
  cross join period where r.id=p_run;
$$;

create function public.reserve_scan_score(p_job uuid,p_lease uuid,p_key text)
returns text language plpgsql set search_path='' as $$
declare j public.scan_jobs; owner_id uuid;
begin
  select p.id into strict owner_id from public.scan_jobs s join public.niches n on n.id=s.niche_id
    join public.profiles p on p.id=n.user_id where s.id=p_job for update of p;
  select s.* into j from public.scan_jobs s join public.niches n on n.id=s.niche_id
    join public.scan_runs r on r.id=s.run_id
    where s.id=p_job and s.lease=p_lease and s.done_at is null and (n.active or r.credit_limit is not null)
      and s.source=any(n.sources);
  if not found then return 'skipped'; end if;
  if exists (select 1 from public.usage_events where user_id=owner_id and request_key=p_key) then return 'duplicate'; end if;
  if public.scan_allowance(j.run_id)<1 then return 'limited'; end if;
  if not public.reserve_usage(owner_id,p_key,'score',1) then return 'limited'; end if;
  update public.usage_events set niche_id=j.niche_id,source=j.source,scan_job_id=j.id,scan_run_id=j.run_id
    where user_id=owner_id and request_key=p_key;
  return 'reserved';
end $$;

create function public.finalize_scan_score(p_user uuid,p_key text,p_lead jsonb)
returns boolean language plpgsql set search_path='' as $$
declare e public.usage_events; inserted boolean;
begin
  select * into e from public.usage_events where user_id=p_user and request_key=p_key and type='score' and settled_at is null for update;
  if not found then return false; end if;
  inserted := public.finalize_score(p_user,p_key,p_lead);
  update public.scan_run_sources set scored=scored+1,matched=matched+inserted::integer,spent=spent+e.cost_credits
    where job_id=e.scan_job_id;
  return inserted;
end $$;

create function public.claim_run_scan_jobs(p_run uuid,p_limit integer)
returns setof public.scan_jobs language sql set search_path='' as $$
  with batch as (
    select j.id from public.scan_jobs j
    where j.run_id=p_run and j.done_at is null and j.available_at<=now() and j.scan_hour>now()-interval '6 hours'
      and not exists(select 1 from public.source_backoffs b where b.source=case when j.source in ('reddit','x','forums','indiehackers') then 'exa' else j.source end and b.retry_at>now())
    order by j.id for update skip locked limit p_limit
  ) update public.scan_jobs j set lease=gen_random_uuid(),available_at=now()+interval '6 minutes',attempts=j.attempts+1
    from batch where j.id=batch.id returning j.*;
$$;
revoke all on function public.start_manual_scan(uuid,uuid,uuid,integer),public.scan_allowance(uuid),
  public.reserve_scan_score(uuid,uuid,text),public.finalize_scan_score(uuid,text,jsonb),public.claim_run_scan_jobs(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.start_manual_scan(uuid,uuid,uuid,integer),public.scan_allowance(uuid),
  public.reserve_scan_score(uuid,uuid,text),public.finalize_scan_score(uuid,text,jsonb),public.claim_run_scan_jobs(uuid,integer)
  to service_role;

create function public.save_scan_budget(p_user uuid,p_niche uuid,p_limit integer)
returns void language plpgsql set search_path='' as $$
begin
  if p_limit<0 then raise exception 'Invalid budget'; end if;
  perform 1 from public.profiles where id=p_user for update;
  if p_niche is null then
    update public.profiles set monthly_reply_reserve=p_limit where id=p_user;
  else
    update public.niches set monthly_score_limit=p_limit where id=p_niche and user_id=p_user;
  end if;
  if not found then raise exception 'Unknown search or workspace'; end if;
end $$;

create function public.monthly_scan_usage()
returns table(niche_id uuid,kind text,credits integer) language sql stable set search_path='' as $$
  select u.niche_id,u.type,sum(u.cost_credits)::integer from public.usage_events u
  where u.user_id=(select auth.uid()) and u.type in ('response','score') and u.created_at>=
    (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')
  group by u.niche_id,u.type
$$;
revoke all on function public.save_scan_budget(uuid,uuid,integer),public.monthly_scan_usage() from public,anon,authenticated;
grant execute on function public.save_scan_budget(uuid,uuid,integer) to service_role;
grant execute on function public.monthly_scan_usage() to authenticated;
