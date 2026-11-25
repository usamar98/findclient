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
