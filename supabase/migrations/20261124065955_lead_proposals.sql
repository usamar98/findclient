create table public.lead_proposals (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 96000),
  published_document jsonb check (jsonb_typeof(published_document) = 'object' and octet_length(published_document::text) <= 96000),
  share_token uuid unique,
  revision integer not null default 0,
  open_count integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  check ((share_token is null) = (published_document is null))
);

alter table public.lead_proposals enable row level security;
create policy team_proposal on public.lead_proposals to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_proposals.lead_id))
  with check (exists (select 1 from public.leads l where l.id = lead_proposals.lead_id));
revoke all on public.lead_proposals from public, anon, authenticated;
grant select on public.lead_proposals to authenticated, service_role;
grant insert (lead_id, document), update (document, published_document, share_token, revision)
  on public.lead_proposals to authenticated;

-- Keep the published snapshot stable while the team edits its private draft.
create function public.save_lead_proposal(
  p_lead uuid, p_document jsonb, p_action text, p_revision integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_row public.lead_proposals%rowtype;
begin
  if p_action not in ('save', 'publish', 'rotate', 'revoke') or p_action is null then
    raise exception 'Invalid proposal action';
  end if;
  if not exists (select 1 from public.leads where id = p_lead) then
    raise exception 'Lead unavailable';
  end if;
  if p_revision = 0 and p_action in ('save', 'publish') then
    insert into public.lead_proposals (lead_id, document) values (p_lead, p_document)
      on conflict (lead_id) do nothing;
  end if;
  select * into current_row from public.lead_proposals where lead_id = p_lead for update;
  if not found or current_row.revision is distinct from p_revision then return false; end if;
  if p_action in ('rotate', 'revoke') and current_row.share_token is null then return false; end if;
  update public.lead_proposals set
    document = case when p_action in ('save', 'publish') then p_document else document end,
    published_document = case when p_action = 'revoke' then null when p_action = 'publish' then p_document else published_document end,
    share_token = case when p_action = 'revoke' then null when p_action = 'rotate' then gen_random_uuid()
      when p_action = 'publish' then coalesce(share_token, gen_random_uuid()) else share_token end,
    revision = revision + 1
    where lead_id = p_lead;
  return true;
end $$;
revoke all on function public.save_lead_proposal(uuid,jsonb,text,integer) from public, anon;
grant execute on function public.save_lead_proposal(uuid,jsonb,text,integer) to authenticated;

create table private.proposal_visits (
  lead_id uuid not null references public.lead_proposals on delete cascade,
  visit_id uuid not null,
  primary key (lead_id, visit_id)
);
revoke all on private.proposal_visits from public, anon, authenticated;

-- A visible page records one open per visit. Reloads and concurrent retries are idempotent.
create function public.record_proposal_open(p_token uuid, p_visit uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare matched uuid;
begin
  select lead_id into matched from public.lead_proposals where share_token = p_token for update;
  if not found then return; end if;
  insert into private.proposal_visits (lead_id, visit_id) values (matched, p_visit) on conflict do nothing;
  if found then
    update public.lead_proposals set open_count = open_count + 1,
      first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now() where lead_id = matched;
  end if;
end $$;
revoke all on function public.record_proposal_open(uuid,uuid) from public, anon, authenticated;
grant execute on function public.record_proposal_open(uuid,uuid) to service_role;
