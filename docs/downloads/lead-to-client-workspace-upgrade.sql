-- Lead To Client workspace upgrade for an existing project.
-- Run once in the SQL Editor after the November 23 and 24 workspace migrations and before deploying the matching app version.
-- The three migrations are applied together. CLI-managed projects can apply the individual pending migrations instead.

BEGIN;

-- Source: supabase/migrations/20261125010000_scan_receipts_and_budgets.sql
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

-- Source: supabase/migrations/20261125020000_workspace_automations.sql
create table public.lead_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  enabled boolean not null default true,
  niche_id uuid references public.niches on delete cascade,
  source text check (source in ('hn','shopify','bluesky','stackexchange','reddit','x','forums','indiehackers')),
  min_score int not null default 85 check (min_score between 0 and 100),
  require_budget boolean not null default false,
  assignee_id uuid references public.profiles on delete cascade,
  draft_reply boolean not null default false,
  telegram boolean not null default false,
  created_at timestamptz not null default now(),
  check (assignee_id is not null or draft_reply or telegram)
);
create index lead_rules_owner on public.lead_rules(user_id, created_at);
alter table public.lead_rules enable row level security;
revoke all on public.lead_rules from public, anon, authenticated;
grant select on public.lead_rules to authenticated;
grant all on public.lead_rules to service_role;
create policy own_lead_rules on public.lead_rules for select to authenticated
  using (user_id = (select auth.uid()));

create function private.check_lead_rule() returns trigger language plpgsql set search_path='' as $$
begin
  if new.niche_id is not null and not exists (
    select 1 from public.niches where id=new.niche_id and user_id=new.user_id
  ) then raise exception 'Choose a search in your workspace'; end if;
  if new.assignee_id is not null and new.assignee_id <> new.user_id and not exists (
    select 1 from public.workspace_members where owner_id=new.user_id and member_id=new.assignee_id
  ) then raise exception 'Choose a current workspace member'; end if;
  if new.telegram and new.enabled and not exists (
    select 1 from public.profiles where id=new.user_id and telegram_chat_id is not null
  ) then raise exception 'Connect Telegram in Settings first'; end if;
  return new;
end $$;
create trigger validate_rule before insert or update on public.lead_rules
for each row execute function private.check_lead_rule();

-- A source post can match more than one rule. Combine actions and allow one draft
-- and one Telegram delivery per lead. The earliest matching assignment wins.
create function private.apply_lead_rules() returns trigger language plpgsql set search_path='' as $$
declare
  rule public.lead_rules;
  assignee uuid;
  wants_draft boolean := false;
  wants_telegram boolean := false;
  draft_job uuid;
begin
  if new.status not in ('new','saved') or new.buyer_intelligence #>> '{availability,state}' = 'closed' then return new; end if;
  for rule in select * from public.lead_rules r
    where r.enabled and r.user_id=new.user_id and (r.niche_id is null or r.niche_id=new.niche_id)
      and (r.source is null or r.source=new.source) and new.intent_score>=r.min_score
      and (not r.require_budget or new.buyer_intelligence->>'positive_budget'='true')
    order by r.created_at,r.id
  loop
    if assignee is null and rule.assignee_id is not null then
      if rule.assignee_id=new.user_id then assignee:=new.user_id;
      else
        select member_id into assignee from public.workspace_members
          where owner_id=new.user_id and member_id=rule.assignee_id for key share;
      end if;
    end if;
    wants_draft:=wants_draft or rule.draft_reply;
    wants_telegram:=wants_telegram or rule.telegram;
  end loop;
  if assignee is not null and new.assignee_id is null then
    update public.leads set assignee_id=assignee where id=new.id;
  end if;
  if wants_draft then
    insert into public.notifications(user_id,kind,event_key,payload)
      values(new.user_id,'rule_draft','rule-draft:'||new.id,jsonb_build_object('id',new.id))
      on conflict(event_key) do nothing returning id into draft_job;
  end if;
  if wants_telegram and exists(select 1 from public.profiles where id=new.user_id and telegram_chat_id is not null) then
    -- on_lead has already enqueued any standard priority alert for this post.
    insert into public.notifications(user_id,kind,event_key,payload)
      values(new.user_id,'telegram','lead:'||new.id,jsonb_build_object('id',new.id,'rule_alert',true,'draft_id',draft_job))
      on conflict(event_key) do update set payload=public.notifications.payload||excluded.payload;
  end if;
  return new;
end $$;
create trigger workflow_rules_apply after insert on public.leads for each row execute function private.apply_lead_rules();

create table public.proposal_workflow_settings (
  user_id uuid primary key references public.profiles on delete cascade,
  enabled boolean not null default true,
  delay_days smallint not null default 3 check(delay_days between 1 and 30)
);
create table public.proposal_followups (
  lead_id uuid primary key references public.lead_proposals on delete cascade,
  due_at timestamptz not null,
  draft text check (length(draft) between 1 and 10000),
  cancelled_at timestamptz,
  prepared_at timestamptz
);
create index pending_proposal_followups on public.proposal_followups(due_at)
  where cancelled_at is null and prepared_at is null;
alter table public.proposal_followups enable row level security;
alter table public.proposal_workflow_settings enable row level security;
revoke all on public.proposal_followups,public.proposal_workflow_settings from public,anon,authenticated;
grant select on public.proposal_followups,public.proposal_workflow_settings to authenticated;
grant update(draft) on public.proposal_followups to authenticated;
grant all on public.proposal_followups,public.proposal_workflow_settings to service_role;
create policy view_followup on public.proposal_followups for select to authenticated using (
  exists(select 1 from public.leads where id=lead_id)
);
create policy view_workflow_settings on public.proposal_workflow_settings for select to authenticated
  using (user_id=(select auth.uid()));
create policy edit_followup_draft on public.proposal_followups for update to authenticated
  using (prepared_at is not null and cancelled_at is null and exists(select 1 from public.leads where id=lead_id))
  with check (draft is not null and exists(select 1 from public.leads where id=lead_id));

create function private.start_proposal_followup() returns trigger language plpgsql set search_path='' as $$
declare
  owner_id uuid;
  delay_days int;
begin
  select l.user_id, coalesce(s.delay_days,3) into owner_id,delay_days
    from public.leads l left join public.proposal_workflow_settings s on s.user_id=l.user_id
    where l.id=new.lead_id and coalesce(s.enabled,true) and l.status not in ('call_booked','won','lost','ignored')
    for no key update of l;
  if not found then return new; end if;
  insert into public.proposal_followups(lead_id,due_at) values(new.lead_id,new.first_opened_at + make_interval(days=>delay_days));
  insert into public.notifications(user_id,kind,event_key,payload)
    values(owner_id,'proposal_open','proposal-open:'||new.lead_id,jsonb_build_object('id',new.lead_id))
    on conflict(event_key) do nothing;
  return new;
end $$;
create trigger proposal_first_open after update of first_opened_at on public.lead_proposals
  for each row when(old.first_opened_at is null and new.first_opened_at is not null)
  execute function private.start_proposal_followup();

-- These triggers also run for RLS-bound workspace edits. The target is always derived
-- from the changed row and the functions never accept caller-supplied identities.
create function private.cancel_proposal_followup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='leads' then
    update public.proposal_followups set cancelled_at=now() where lead_id=new.id and cancelled_at is null;
  else
    update public.proposal_followups set cancelled_at=now() where lead_id=new.lead_id and cancelled_at is null;
  end if;
  return new;
end $$;
create trigger stop_proposal_sequence after update of status on public.leads for each row
  when (old.status is distinct from new.status and new.status in ('call_booked','won','lost','ignored'))
  execute function private.cancel_proposal_followup();
create trigger stop_revoked_proposal after update of share_token on public.lead_proposals for each row
  when (new.share_token is null and old.share_token is not null) execute function private.cancel_proposal_followup();

create function private.adjust_proposal_followups() returns trigger language plpgsql set search_path='' as $$
begin
  update public.proposal_followups f set
    cancelled_at=case when not new.enabled then now() end,
    due_at=p.first_opened_at + make_interval(days=>new.delay_days)
    from public.leads l join public.lead_proposals p on p.lead_id=l.id
    where f.lead_id=l.id and l.user_id=new.user_id and f.cancelled_at is null and f.prepared_at is null;
  return new;
end $$;
create trigger changed_proposal_sequence after insert or update on public.proposal_workflow_settings
  for each row execute function private.adjust_proposal_followups();

create function public.prepare_proposal_followups() returns int language plpgsql set search_path='' as $$
declare prepared int;
begin
  with due as (
    select f.lead_id, l.user_id, p.published_document as doc
      from public.proposal_followups f join public.leads l on l.id=f.lead_id
      join public.lead_proposals p on p.lead_id=f.lead_id
      left join public.proposal_workflow_settings s on s.user_id=l.user_id
      where f.due_at<=now() and f.cancelled_at is null and f.prepared_at is null and p.share_token is not null
        and coalesce(s.enabled,true) and l.status not in ('call_booked','won','lost','ignored')
      order by f.due_at limit 50 for update of f skip locked
  ), ready as (
    update public.proposal_followups f set prepared_at=now(),
      draft=format('Hi %s, I wanted to follow up on %s. Do you have any questions about the scope or timing? I would be happy to walk through the options together.',
        coalesce(nullif(due.doc->>'recipient',''),'there'),coalesce(nullif(due.doc->>'title',''),'the proposal'))
    from due where f.lead_id=due.lead_id returning due.user_id, f.lead_id
  )
  insert into public.notifications(user_id,kind,event_key,payload)
    select user_id,'proposal_followup_ready','proposal-followup:'||lead_id,jsonb_build_object('id',lead_id)
    from ready on conflict(event_key) do nothing;
  get diagnostics prepared=row_count;
  return prepared;
end $$;
revoke all on function private.check_lead_rule(),private.apply_lead_rules(),private.start_proposal_followup(),
  private.cancel_proposal_followup(),private.adjust_proposal_followups(),public.prepare_proposal_followups()
  from public,anon,authenticated;
grant execute on function public.prepare_proposal_followups() to service_role;

-- Keep automatic replies in the same manual spending envelope as the scoring
-- that triggered the rule. A reply explicitly requested on a lead stays separate.
alter table public.leads add column rule_draft_capped boolean not null default false;
alter table public.scan_run_sources
  add column drafted integer not null default 0,
  add column draft_skipped integer not null default 0;

create function public.reserve_rule_draft(p_notice uuid) returns text language plpgsql set search_path='' as $$
declare
  job public.notifications;
  lead public.leads;
  charge_key text;
  previous public.usage_events;
  origin record;
begin
  select * into job from public.notifications where id=p_notice and kind='rule_draft';
  if not found then return 'obsolete'; end if;
  -- All scan scorers take this same lock before examining the run's credit limit.
  perform 1 from public.profiles where id=job.user_id for update;
  select * into lead from public.leads where id=(job.payload->>'id')::uuid and user_id=job.user_id;
  if not found or lead.status not in ('new','saved') or lead.buyer_intelligence #>> '{availability,state}'='closed'
    then return 'obsolete'; end if;
  if lead.rule_draft_capped then return 'cap_reached'; end if;
  charge_key := 'reply:'||lead.id||':'||job.id;
  select * into previous from public.usage_events where user_id=job.user_id and request_key=charge_key;
  if found then return case when previous.settled_at is null then 'busy' else 'settled' end; end if;

  select e.scan_job_id, r.id as run_id, r.credit_limit into origin
    from public.usage_events e join public.scan_runs r on r.id=e.scan_run_id
    where e.user_id=lead.user_id and e.type='score' and e.settled_at is not null and r.user_id=lead.user_id
      and r.niche_id=lead.niche_id and e.source=lead.source
      and e.request_key='score:'||encode(sha256(convert_to(lead.niche_id::text||chr(10)||lead.url,'UTF8')),'hex');
  if origin.credit_limit is not null and (
    select coalesce(sum(e.cost_credits),0) from public.usage_events e where e.scan_run_id=origin.run_id
  ) >= origin.credit_limit then
    update public.leads set rule_draft_capped=true where id=lead.id;
    update public.scan_run_sources set draft_skipped=draft_skipped+1 where job_id=origin.scan_job_id;
    return 'cap_reached';
  end if;
  if not public.reserve_usage(lead.user_id,charge_key,'response',1) then return 'no_credit'; end if;
  update public.usage_events set scan_run_id=origin.run_id,scan_job_id=origin.scan_job_id,
    niche_id=lead.niche_id,source=lead.source where user_id=lead.user_id and request_key=charge_key;
  return 'reserved';
end $$;

create function private.record_rule_draft_spend() returns trigger language plpgsql set search_path='' as $$
begin
  update public.scan_run_sources set drafted=drafted+1, spent=spent+new.cost_credits
    where job_id=new.scan_job_id and run_id=new.scan_run_id;
  return new;
end $$;
create trigger settled_rule_draft after update of settled_at on public.usage_events for each row
  when (new.type='response' and new.scan_run_id is not null and old.settled_at is null and new.settled_at is not null)
  execute function private.record_rule_draft_spend();
revoke all on function public.reserve_rule_draft(uuid), private.record_rule_draft_spend() from public,anon,authenticated;
grant execute on function public.reserve_rule_draft(uuid) to service_role;

-- Source: supabase/migrations/20261125030000_workspace_results.sql
-- Record the stages a lead actually entered, including when it later moves on.
alter table public.leads
  add column recorded_reply boolean not null default false,
  add column recorded_call boolean not null default false;

update public.leads
set recorded_reply = (status = 'replied'), recorded_call = (status = 'call_booked')
where status in ('replied', 'call_booked');

create function private.record_lead_milestones() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'replied' then new.recorded_reply := true; end if;
  if new.status = 'call_booked' then new.recorded_call := true; end if;
  return new;
end $$;
revoke all on function private.record_lead_milestones() from public, anon, authenticated;
create trigger lead_result_milestones before insert or update of status on public.leads
for each row execute function private.record_lead_milestones();

-- Recover only charges whose original request key matches a surviving record.
update public.usage_events u
set niche_id = l.niche_id, source = l.source
from public.leads l
where u.user_id = l.user_id and u.type = 'score' and u.source is null
  and u.request_key = 'score:' || encode(sha256(convert_to(l.niche_id::text || chr(10) || l.url, 'UTF8')), 'hex');

update public.usage_events u
set niche_id = l.niche_id, source = l.source
from public.responses r join public.leads l on l.id = r.lead_id and l.user_id = r.user_id
where u.user_id = r.user_id and u.type = 'response' and u.source is null
  and u.request_key = 'reply:' || l.id::text || ':' || r.id::text;

create or replace function public.finalize_reply(
  p_user uuid, p_key text, p_lead uuid, p_id uuid, p_tone text, p_solution text, p_pitch text
) returns boolean language plpgsql set search_path = '' as $$
begin
  update public.usage_events
  set settled_at = now(), (niche_id, source) = (
    select l.niche_id, l.source from public.leads l where l.id = p_lead and l.user_id = p_user
  )
  where user_id = p_user and request_key = p_key and type = 'response' and settled_at is null;
  if not found then return false; end if;
  insert into public.responses (id, user_id, lead_id, tone, solution_md, pitch_md)
  values (p_id, p_user, p_lead, p_tone, p_solution, p_pitch);
  return true;
end $$;

-- Aggregate lead and credit activity separately in the same stream. Joining raw
-- usage to leads would multiply won revenue for every draft or score.
create function public.workspace_results(p_owner uuid, p_group text)
returns table (
  group_id text, search_name text, leads_found bigint, replies bigint, calls bigint,
  wins bigint, revenue_cents bigint, score_credits bigint, reply_credits bigint
)
language sql stable security invoker set search_path = '' as $$
  with activity as (
    select l.source, l.niche_id, 1 as lead_count, l.recorded_reply::int as reply_count,
           l.recorded_call::int as call_count, (l.status = 'won')::int as win_count,
           case when l.status = 'won' then l.deal_value_cents else 0 end as amount,
           0 as score_cost, 0 as draft_cost
    from public.leads l where l.user_id = p_owner
    union all
    select u.source, u.niche_id, 0, 0, 0, 0, 0,
           case when u.type = 'score' then u.cost_credits else 0 end,
           case when u.type = 'response' then u.cost_credits else 0 end
    from public.usage_events u
    where u.user_id = p_owner and p_owner = (select auth.uid())
      and u.type in ('score','response') and u.settled_at is not null
  ), totals as (
    select case when p_group = 'platform' then a.source else a.niche_id::text end as bucket,
           sum(a.lead_count) as leads_found, sum(a.reply_count) as replies,
           sum(a.call_count) as calls, sum(a.win_count) as wins, sum(a.amount)::bigint as revenue_cents,
           sum(a.score_cost) as score_credits, sum(a.draft_cost) as reply_credits
    from activity a where p_group in ('platform','search') group by 1
  )
  select t.bucket, n.skill, t.leads_found, t.replies, t.calls, t.wins, t.revenue_cents,
         case when p_owner = (select auth.uid()) then t.score_credits end,
         case when p_owner = (select auth.uid()) then t.reply_credits end
  from totals t left join public.niches n
    on p_group = 'search' and n.user_id = p_owner and n.id::text = t.bucket
  order by t.revenue_cents desc, t.wins desc, t.leads_found desc, n.skill, t.bucket;
$$;
revoke all on function public.workspace_results(uuid,text) from public, anon;
grant execute on function public.workspace_results(uuid,text) to authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
