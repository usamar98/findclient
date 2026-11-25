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
