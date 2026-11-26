begin;

-- A job saved from a public listing has neither a saved search nor an intent
-- assessment. Existing scanner records retain both requirements.
alter table public.leads
  add column applied_at timestamptz,
  alter column niche_id drop not null,
  alter column intent_score drop not null,
  drop constraint leads_score_method_check,
  add constraint leads_score_method_check check (
    (score_method = 'manual' and intent_score is null and niche_id is null)
    or (score_method in ('ai', 'local') and intent_score is not null and niche_id is not null)
  );
create index leads_applied on public.leads(user_id, applied_at desc) where applied_at is not null;

-- Manual inbox saves do not run scanner automations or enqueue site audits.
create or replace trigger on_lead after insert on public.leads for each row
  when (new.score_method <> 'manual') execute function private.lead_alert();
create or replace trigger workflow_rules_apply after insert on public.leads for each row
  when (new.score_method <> 'manual') execute function private.apply_lead_rules();
create or replace trigger queue_lead_site after insert on public.leads for each row
  when (new.score_method <> 'manual') execute function private.queue_lead_site();

create or replace function public.queue_digests() returns void language sql security invoker set search_path = '' as $$
  insert into public.notifications(user_id, kind, event_key, payload)
  select p.id, 'digest', 'digest:' || p.id || ':' || current_date, jsonb_build_object('leads', items.val)
  from public.profiles p cross join lateral (
    select jsonb_agg(x) as val from (
      select id, title, intent_score from public.leads
      where user_id = p.id and intent_score is not null and created_at >= now() - interval '24 hours'
      order by intent_score desc limit 5
    ) x
  ) items where p.digest_enabled and items.val is not null
  on conflict(event_key) do nothing;
$$;

-- authenticated readers can only look up their personal inbox, even if another
-- workspace has a tracked entry for the same public URL.
create function public.get_job_tracking(p_urls text[])
returns table(id uuid, url text, applied_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select l.id, l.url, l.applied_at from public.leads l
  where l.user_id = (select auth.uid()) and l.url = any(p_urls);
$$;
revoke all on function public.get_job_tracking(text[]) from public, anon;
grant execute on function public.get_job_tracking(text[]) to authenticated;

-- Only the authenticated server action calls this writer. It passes the owner
-- from the verified session and verifies the signature on the listing first.
-- The existing (user_id,url) unique constraint serializes saves, applications
-- and scan inserts. On conflict, keep all captured content and CRM fields.
create function public.track_inbox_job(p_owner uuid, p_job jsonb, p_applied boolean)
returns table(id uuid, applied_at timestamptz)
language sql security invoker set search_path = '' as $$
  insert into public.leads as l(user_id, source, url, author, title, body, posted_at, budget_signal,
    status, score_method, intent_reason, applied_at)
  values(p_owner, p_job->>'source', p_job->>'url', p_job->>'author', p_job->>'title', p_job->>'excerpt',
    (p_job->>'posted_at')::timestamptz, p_job->>'compensation', 'saved', 'manual',
    'Saved from a job listing.', case when p_applied then now() end)
  on conflict(user_id, url) do update
    set status = case when l.status = 'new' then 'saved' else l.status end,
        applied_at = coalesce(l.applied_at, excluded.applied_at)
  returning l.id, l.applied_at;
$$;

create function public.mark_inbox_job_applied(p_actor uuid, p_lead uuid)
returns timestamptz language sql security invoker set search_path = '' as $$
  update public.leads l set applied_at = coalesce(l.applied_at, now())
  where l.id = p_lead and (l.user_id = p_actor or exists (
    select 1 from public.workspace_members m where m.owner_id = l.user_id and m.member_id = p_actor
  ))
  returning l.applied_at;
$$;
revoke all on function public.track_inbox_job(uuid,jsonb,boolean),
  public.mark_inbox_job_applied(uuid,uuid) from public, anon, authenticated;
grant execute on function public.track_inbox_job(uuid,jsonb,boolean),
  public.mark_inbox_job_applied(uuid,uuid) to service_role;

commit;
