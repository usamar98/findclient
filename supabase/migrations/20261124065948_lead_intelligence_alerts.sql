alter table public.profiles
  add column fast_discovery boolean not null default true,
  add column priority_email boolean not null default false,
  add column priority_alert_min integer not null default 80 check (priority_alert_min between 0 and 100);

alter table public.leads
  add column buyer_intelligence jsonb check (jsonb_typeof(buyer_intelligence) = 'object'),
  add column buyer_quality_score integer generated always as ((buyer_intelligence->>'quality_score')::integer) stored check (buyer_quality_score between 0 and 100),
  add column match_feedback text check (match_feedback in ('good_fit','wrong_service','diy','seller')),
  add column match_feedback_at timestamptz;

create index leads_buyer_quality on public.leads(user_id,buyer_quality_score desc nulls last);
create index leads_missing_intelligence on public.leads(created_at desc) where buyer_intelligence is null;
create index leads_match_feedback on public.leads(niche_id,match_feedback_at desc) where match_feedback is not null;
create function private.stamp_match_feedback() returns trigger language plpgsql set search_path='' as $$
begin
  new.match_feedback_at = case when new.match_feedback is not null then now() end;
  return new;
end $$;
create trigger stamp_match_feedback before update of match_feedback on public.leads
  for each row when (old.match_feedback is distinct from new.match_feedback)
  execute function private.stamp_match_feedback();
grant update(match_feedback) on public.leads to authenticated;
create index scan_pending_source on public.scan_jobs(niche_id,source,scan_hour) where done_at is null;

-- Keep credential-bearing handoff URLs out of the profile row and shared workspace reads.
create table public.alert_destinations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  webhook_url text not null check (length(webhook_url) between 12 and 1600)
);
alter table public.alert_destinations enable row level security;
revoke all on public.alert_destinations from public, anon, authenticated;
grant all on public.alert_destinations to service_role;

create function public.save_alert_settings(p_user uuid,p_fast boolean,p_email boolean,p_min integer,p_webhook text)
returns void language plpgsql set search_path = '' as $$
begin
  update public.profiles set fast_discovery=p_fast,priority_email=p_email,priority_alert_min=p_min where id=p_user;
  if not found then raise exception 'Unknown workspace'; end if;
  if p_webhook = '' then
    delete from public.alert_destinations where user_id=p_user;
  elsif p_webhook is not null then
    insert into public.alert_destinations (user_id,webhook_url) values (p_user,p_webhook)
      on conflict (user_id) do update set webhook_url=excluded.webhook_url;
  end if;
end $$;
revoke all on function public.save_alert_settings(uuid,boolean,boolean,integer,text) from public,anon,authenticated;
grant execute on function public.save_alert_settings(uuid,boolean,boolean,integer,text) to service_role;

create or replace function public.enqueue_scans() returns int language plpgsql set search_path = '' as $$
declare queued integer;
begin
  insert into public.scan_jobs(niche_id,source,scan_hour)
  select n.id, s.value,
    case when p.fast_discovery and s.value in ('hn','bluesky','shopify')
      then date_bin(interval '10 minutes',now(),'2000-01-01'::timestamptz)
      else date_trunc('hour',now()) end
  from public.niches n join public.profiles p on p.id=n.user_id cross join lateral unnest(n.sources) s(value)
  where n.active and p.credits>0
    and not exists(select 1 from public.scan_jobs j where j.niche_id=n.id and j.source=s.value
      and j.done_at is null and j.scan_hour>=date_trunc('hour',now())-interval '6 hours')
    and not exists(select 1 from public.source_backoffs b
      where b.source=case when s.value in ('reddit','x','forums','indiehackers') then 'exa' else s.value end and b.retry_at>now())
  on conflict(niche_id,source,scan_hour) do nothing;
  get diagnostics queued=row_count;
  return queued;
end $$;

create or replace function public.finalize_score(p_user uuid,p_key text,p_lead jsonb) returns boolean language plpgsql set search_path = '' as $$
begin
  update public.usage_events set settled_at=now()
    where user_id=p_user and request_key=p_key and type='score' and settled_at is null;
  if not found or p_lead is null then return false; end if;
  insert into public.leads(user_id,niche_id,source,url,author,title,body,posted_at,intent_score,intent_reason,problem_summary,budget_signal,urgency,buyer_intelligence)
  values (p_user,(p_lead->>'niche_id')::uuid,p_lead->>'source',p_lead->>'url',p_lead->>'author',p_lead->>'title',p_lead->>'body',
    (p_lead->>'posted_at')::timestamptz,(p_lead->>'intent_score')::int,p_lead->>'intent_reason',p_lead->>'problem_summary',
    p_lead->>'budget_signal',p_lead->>'urgency',p_lead->'buyer_intelligence')
    on conflict(user_id,url) do nothing;
  return found;
end $$;

create or replace function private.lead_alert() returns trigger language plpgsql set search_path = '' as $$
declare prefs public.profiles; notification jsonb;
begin
  select * into strict prefs from public.profiles where id=new.user_id;
  if new.intent_score < prefs.priority_alert_min or new.buyer_intelligence->'availability'->>'state'='closed' then return new; end if;
  notification=jsonb_build_object('id',new.id,'title',new.title,'score',new.intent_score);
  if prefs.telegram_chat_id is not null then
    insert into public.notifications(user_id,kind,event_key,payload) values(new.user_id,'telegram','lead:'||new.id,notification);
  end if;
  if prefs.priority_email then
    insert into public.notifications(user_id,kind,event_key,payload) values(new.user_id,'priority_email','priority-email:'||new.id,notification);
  end if;
  if exists(select 1 from public.alert_destinations where user_id=new.user_id) then
    insert into public.notifications(user_id,kind,event_key,payload) values(new.user_id,'webhook','webhook:'||new.id,notification);
  end if;
  return new;
end $$;
