alter table public.profiles
  add column voice_examples text not null default '' check (length(voice_examples) <= 3000),
  add column learn_from_edits boolean not null default false;
grant update(voice_examples,learn_from_edits) on public.profiles to authenticated;

alter table public.responses add column voice_author_id uuid references public.profiles on delete set null,
  add column voice_edited_at timestamptz, add column voice_sample text;
create index responses_author_voice on public.responses(voice_author_id, voice_edited_at desc)
  where voice_author_id is not null;
create function private.remember_reply_editor() returns trigger language plpgsql set search_path='' as $$
begin
  if (new.solution_md,new.pitch_md) is distinct from (old.solution_md,old.pitch_md) then
    new.voice_author_id := null;
    new.voice_edited_at := null;
    new.voice_sample := null;
    if exists(select 1 from public.profiles where id=(select auth.uid()) and learn_from_edits) then
      new.voice_author_id := (select auth.uid());
      new.voice_edited_at := now();
      new.voice_sample := left(concat_ws(' ',
        case when new.pitch_md is distinct from old.pitch_md then new.pitch_md end,
        case when new.solution_md is distinct from old.solution_md then new.solution_md end), 1000);
    end if;
  end if;
  return new;
end $$;
create trigger remember_reply_editor before update of solution_md,pitch_md on public.responses
  for each row execute function private.remember_reply_editor();
revoke all on function private.remember_reply_editor() from public, anon, authenticated;

create table public.lead_site_audits (
  lead_id uuid primary key references public.leads on delete cascade,
  target_url text check(length(target_url) <= 1500),
  status text not null default 'queued' check(status in ('queued','checking','complete','no_site','unavailable')),
  report jsonb, failure text, attempts integer not null default 0,
  due_at timestamptz not null default now(), lease uuid, updated_at timestamptz not null default now()
);
alter table public.lead_site_audits enable row level security;
revoke all on public.lead_site_audits from public, anon, authenticated;
grant select on public.lead_site_audits to authenticated;
grant all on public.lead_site_audits to service_role;
create policy read_lead_audit on public.lead_site_audits for select to authenticated using (
  exists (select 1 from public.leads l where l.id=lead_id)
);
create index audits_due on public.lead_site_audits(due_at) where status in ('queued','checking');
create function private.queue_lead_site() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.buyer_intelligence->>'site' is not null or (new.title || ' ' || new.body) ~* '[a-z0-9-]+[.][a-z]{2,}' then
    insert into public.lead_site_audits(lead_id,target_url)
      values(new.id,new.buyer_intelligence->>'site') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger queue_lead_site after insert on public.leads for each row execute function private.queue_lead_site();
revoke all on function private.queue_lead_site() from public, anon, authenticated;
insert into public.lead_site_audits(lead_id)
select id from public.leads where (title || ' ' || body) ~* '[a-z0-9-]+[.][a-z]{2,}' on conflict do nothing;

create function public.claim_lead_audits(p_lead uuid default null, p_limit integer default 4)
returns table(lead_id uuid,target_url text,lease uuid,attempts integer,title text,body text,source_url text)
language sql set search_path='' as $$
  with pending as (
    select a.lead_id from public.lead_site_audits a
    where a.status in ('queued','checking') and a.due_at <= now()
      and (p_lead is null or a.lead_id=p_lead)
    order by a.due_at limit greatest(0, least(8,p_limit)) for update skip locked
  ), claimed as (
    update public.lead_site_audits a set status='checking',lease=gen_random_uuid(),
      attempts=a.attempts+1, due_at=now()+interval '2 minutes',updated_at=now()
    from pending p where p.lead_id=a.lead_id returning a.*
  )
  select c.lead_id,c.target_url,c.lease,c.attempts,l.title,l.body,l.url
    from claimed c join public.leads l on l.id=c.lead_id;
$$;
revoke all on function public.claim_lead_audits(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_lead_audits(uuid,integer) to service_role;
