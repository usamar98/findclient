-- Lead To Client scan scoring recovery for an existing workspace installation.
-- Run in Supabase SQL Editor after lead-to-client-workspace-upgrade.sql.
-- Source: supabase/migrations/20261125192651_scan_scoring_recovery.sql

BEGIN;
-- Keep model and local assessments distinguishable, including on older receipts.
alter table public.scan_run_sources
  add column local_scored integer not null default 0 check (local_scored between 0 and scored);
alter table public.leads
  add column score_method text not null default 'ai' check (score_method in ('ai','local'));

-- A local nonmatch can be reconsidered by the model in a subsequent run. A
-- retry of the same run must still skip it and leave its receipt untouched.
create or replace function public.reserve_scan_score(p_job uuid,p_lease uuid,p_key text)
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
  if exists (
    select 1 from public.usage_events where user_id=owner_id
      and request_key in (p_key,p_key||':local:'||j.run_id::text)
  ) then return 'duplicate'; end if;
  if public.scan_allowance(j.run_id)<1 then return 'limited'; end if;
  if not public.reserve_usage(owner_id,p_key,'score',1) then return 'limited'; end if;
  update public.usage_events set niche_id=j.niche_id,source=j.source,scan_job_id=j.id,scan_run_id=j.run_id
    where user_id=owner_id and request_key=p_key;
  return 'reserved';
end $$;

-- Convert only this job's pending reservation to a zero-cost assessment. The
-- refund, lead insert, deduplication key, and receipt commit together.
create function public.finalize_local_score(p_job uuid,p_lease uuid,p_key text,p_lead jsonb)
returns text language plpgsql security invoker set search_path='' as $$
declare
  charge public.usage_events;
  job public.scan_jobs;
  owner_id uuid;
  inserted boolean;
begin
  select r.user_id into owner_id from public.scan_jobs j
    join public.scan_runs r on r.id=j.run_id where j.id=p_job;
  if not found then return 'skipped'; end if;
  perform 1 from public.profiles where id=owner_id for update;
  select * into job from public.scan_jobs
    where id=p_job and lease=p_lease and done_at is null for update;
  if not found then return 'skipped'; end if;
  select * into charge from public.usage_events where user_id=owner_id and request_key=p_key
    and scan_job_id=p_job and scan_run_id=job.run_id and type='score' and settled_at is null for update;
  if not found then return 'skipped'; end if;
  if p_lead is not null and (p_lead->>'niche_id' is distinct from job.niche_id::text
    or p_lead->>'source' is distinct from job.source) then
    raise exception 'Candidate does not belong to this source job';
  end if;

  update public.profiles set credits=credits+charge.cost_credits where id=owner_id;
  update public.usage_events set cost_credits=0 where id=charge.id;
  inserted := public.finalize_scan_score(owner_id,p_key,p_lead);
  if inserted then
    update public.leads set score_method='local' where user_id=owner_id and url=p_lead->>'url';
  else
    update public.usage_events set request_key=p_key||':local:'||job.run_id::text where id=charge.id;
  end if;
  update public.scan_run_sources set local_scored=local_scored+1 where job_id=p_job;
  return case when inserted then 'matched' else 'unmatched' end;
end $$;
revoke all on function public.finalize_local_score(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_local_score(uuid,uuid,text,jsonb) to service_role;

-- Provider cooldowns protect new fetches. Jobs with a persisted response can
-- finish from their snapshot even when another fetch of that provider backed off.
create function private.claim_ready_scan_jobs(p_run uuid,p_limit integer)
returns setof public.scan_jobs language sql security invoker set search_path='' as $$
  with ready as (
    select j.id from public.scan_jobs j
    where (p_run is null or j.run_id=p_run) and j.done_at is null and j.available_at<=now()
      and j.scan_hour>=case when p_run is null then date_trunc('hour',now()) else now() end - interval '6 hours'
      and (j.candidates is not null or not exists (
        select 1 from public.source_backoffs b where b.retry_at>now() and b.source=
          case when j.source in ('reddit','x','forums','indiehackers') then 'exa' else j.source end
      ))
    order by j.scan_hour,j.available_at,j.id for update skip locked limit p_limit
  ) update public.scan_jobs j set lease=gen_random_uuid(),available_at=now()+interval '6 minutes',attempts=j.attempts+1
    from ready where j.id=ready.id returning j.*;
$$;
revoke all on function private.claim_ready_scan_jobs(uuid,integer) from public,anon,authenticated;
grant execute on function private.claim_ready_scan_jobs(uuid,integer) to service_role;

create or replace function public.claim_scan_jobs(p_limit integer)
returns setof public.scan_jobs language sql security invoker set search_path='' as $$
  select * from private.claim_ready_scan_jobs(null,p_limit);
$$;
create or replace function public.claim_run_scan_jobs(p_run uuid,p_limit integer)
returns setof public.scan_jobs language sql security invoker strict set search_path='' as $$
  select * from private.claim_ready_scan_jobs(p_run,p_limit);
$$;

COMMIT;
