-- Each existing account owns a workspace. Team membership only shares lead work.
create table public.workspace_members (
  owner_id uuid not null references public.profiles on delete cascade,
  member_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id, member_id), check (owner_id <> member_id)
);
create index workspace_member_inboxes on public.workspace_members(member_id, owner_id);
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  owner_name text not null,
  email text not null check(email = lower(trim(email)) and length(email) between 3 and 254),
  expires_at timestamptz not null default now() + interval '7 days',
  unique(owner_id, email)
);
create index workspace_invite_email on public.workspace_invites(email);
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
revoke all on public.workspace_members, public.workspace_invites from public, anon, authenticated;
grant select, delete on public.workspace_members, public.workspace_invites to authenticated;
grant all on public.workspace_members, public.workspace_invites to service_role;
create policy membership_read on public.workspace_members for select to authenticated
  using ((select auth.uid()) in (owner_id, member_id));
create policy membership_remove on public.workspace_members for delete to authenticated
  using ((select auth.uid()) in (owner_id, member_id));
create policy invite_read on public.workspace_invites for select to authenticated using (
  owner_id = (select auth.uid()) or email = (select lower(email) from public.profiles where id=(select auth.uid()))
);
create policy invite_cancel on public.workspace_invites for delete to authenticated using (
  owner_id = (select auth.uid()) or email = (select lower(email) from public.profiles where id=(select auth.uid()))
);

create policy team_leads on public.leads for select to authenticated using (
  user_id in (select owner_id from public.workspace_members where member_id=(select auth.uid()))
);
create policy team_edit_leads on public.leads for update to authenticated using (
  user_id in (select owner_id from public.workspace_members where member_id=(select auth.uid()))
) with check (
  user_id in (select owner_id from public.workspace_members where member_id=(select auth.uid()))
);
create policy team_niches on public.niches for select to authenticated using (
  user_id in (select owner_id from public.workspace_members where member_id=(select auth.uid()))
);
create policy team_responses on public.responses for select to authenticated using (
  user_id in (select owner_id from public.workspace_members where member_id=(select auth.uid()))
);
create policy team_edit_responses on public.responses for update to authenticated using (
  user_id in (select owner_id from public.workspace_members where member_id=(select auth.uid()))
) with check (
  user_id in (select owner_id from public.workspace_members where member_id=(select auth.uid()))
);

create function public.workspace_people(p_owner uuid, p_actor uuid)
returns table(id uuid, name text) language sql stable set search_path='' as $$
  select p.id, coalesce(nullif(p.name,''),split_part(p.email,'@',1), 'Teammate')
  from public.profiles p
  where (p_actor=p_owner or exists(select 1 from public.workspace_members
         where owner_id=p_owner and member_id=p_actor))
    and (p.id=p_owner or p.id in (select member_id from public.workspace_members where owner_id=p_owner))
  order by (p.id=p_owner) desc, 2
$$;
create function public.list_workspaces(p_actor uuid)
returns table(id uuid, name text) language sql stable set search_path='' as $$
  select p.id, coalesce(nullif(p.name,''),split_part(p.email,'@',1),'Workspace')
  from public.profiles p where p.id=p_actor or p.id in (
    select owner_id from public.workspace_members where member_id=p_actor
  ) order by (p.id=p_actor) desc, 2
$$;
create function public.invite_workspace_member(p_owner uuid, p_email text)
returns uuid language plpgsql set search_path='' as $$
declare invite_id uuid; display_name text; addr text := lower(trim(p_email));
begin
  select coalesce(nullif(name,''),split_part(email,'@',1)) into strict display_name
  from public.profiles where id=p_owner and lower(email)<>addr;
  if exists(select 1 from public.workspace_members m join public.profiles p on p.id=m.member_id
            where m.owner_id=p_owner and lower(p.email)=addr) then raise exception 'Already on your team'; end if;
  insert into public.workspace_invites(owner_id,owner_name,email)
  values(p_owner,display_name,addr)
  on conflict(owner_id,email) do update set expires_at=now()+interval '7 days',
    id=gen_random_uuid(), owner_name=excluded.owner_name
  returning id into invite_id;
  insert into public.notifications(user_id,kind,event_key,payload)
  values(p_owner,'team_invite','team_invite:'||invite_id,jsonb_build_object('invite',invite_id));
  return invite_id;
end $$;
create function public.accept_workspace_invite(p_invite uuid, p_actor uuid)
returns boolean language plpgsql set search_path='' as $$
declare workspace_owner uuid;
begin
  delete from public.workspace_invites i using public.profiles p
  where i.id=p_invite and p.id=p_actor and lower(p.email)=i.email and i.expires_at>now()
    and i.owner_id<>p_actor
  returning i.owner_id into workspace_owner;
  if not found then return false; end if;
  insert into public.workspace_members(owner_id,member_id) values(workspace_owner,p_actor)
  on conflict do nothing;
  return true;
end $$;
revoke all on function public.workspace_people(uuid,uuid), public.list_workspaces(uuid),
  public.invite_workspace_member(uuid,text), public.accept_workspace_invite(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.workspace_people(uuid,uuid), public.list_workspaces(uuid),
  public.invite_workspace_member(uuid,text), public.accept_workspace_invite(uuid,uuid)
  to service_role;

alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check check (
  status in ('new','saved','replied','call_booked','proposal_sent','won','lost','ignored')
);
alter table public.leads
  add column assignee_id uuid references public.profiles(id) on delete set null,
  add column deal_value_cents bigint not null default 0 check(deal_value_cents between 0 and 99999999999),
  add column follow_up_on date,
  add column crm_version integer not null default 0;
create index leads_assignee on public.leads(assignee_id) where assignee_id is not null;
grant update(assignee_id,deal_value_cents,follow_up_on) on public.leads to authenticated;

create function private.check_lead_crm() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('won','lost','ignored') then new.follow_up_on := null; end if;
  if new.assignee_id is not null and new.assignee_id <> new.user_id then
    perform 1 from public.workspace_members
      where owner_id=new.user_id and member_id=new.assignee_id for key share;
    if not found then raise exception 'Assignee must belong to this workspace'; end if;
  end if;
  if row(new.status,new.assignee_id,new.deal_value_cents,new.follow_up_on) is distinct from
     row(old.status,old.assignee_id,old.deal_value_cents,old.follow_up_on) then
    new.crm_version := old.crm_version + 1;
  end if;
  return new;
end $$;
create trigger lead_crm_guard before update of status,assignee_id,deal_value_cents,follow_up_on on public.leads
for each row execute function private.check_lead_crm();
create function private.sync_follow_up() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid := coalesce(new.assignee_id,new.user_id);
begin
  if row(old.follow_up_on,old.assignee_id) is not distinct from row(new.follow_up_on,new.assignee_id) then return new; end if;
  if old.follow_up_on is not null then
    delete from public.notifications where sent_at is null and
      event_key=concat_ws(':','follow_up',old.id,old.follow_up_on,coalesce(old.assignee_id,old.user_id));
  end if;
  if new.follow_up_on is not null then
    insert into public.notifications(user_id,kind,event_key,payload,available_at)
    values(recipient,'follow_up',concat_ws(':','follow_up',new.id,new.follow_up_on,recipient),
      jsonb_build_object('id',new.id,'date',new.follow_up_on),
      (new.follow_up_on+time '09:00') at time zone 'UTC')
    on conflict(event_key) do nothing;
  end if;
  return new;
end $$;
create trigger lead_follow_up after update of status,assignee_id,follow_up_on on public.leads
for each row execute function private.sync_follow_up();
create function private.unassign_former_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.leads set assignee_id=null where user_id=old.owner_id and assignee_id=old.member_id;
  return old;
end $$;
create trigger membership_removed after delete on public.workspace_members
for each row execute function private.unassign_former_member();
revoke all on function private.check_lead_crm(), private.sync_follow_up(), private.unassign_former_member()
  from public, anon, authenticated;

-- Invoker rights keep this aggregate subject to the same RLS as the inbox.
create function public.pipeline_totals(p_owner uuid)
returns table(found bigint,replied bigint,won bigint,revenue_cents bigint,by_source jsonb)
language sql stable security invoker set search_path='' as $$
  with scoped as (select status,source,deal_value_cents from public.leads where p_owner is null or user_id=p_owner),
  won_sources as (
    select source,count(*) as wins,sum(deal_value_cents) as amount_cents from scoped
    where status='won' group by source
  )
  select count(*),
    count(*) filter(where status in ('replied','call_booked','proposal_sent','won')),
    count(*) filter(where status='won'),
    coalesce(sum(deal_value_cents) filter(where status='won'),0)::bigint,
    coalesce((select jsonb_agg(to_jsonb(won_sources) order by amount_cents desc,source) from won_sources),'[]'::jsonb)
  from scoped
$$;
revoke all on function public.pipeline_totals(uuid) from public, anon;
grant execute on function public.pipeline_totals(uuid) to authenticated,service_role;

create or replace function public.save_niche(p_user uuid,p_id uuid,p_data jsonb)
returns uuid language plpgsql set search_path='' as $$
declare v_plan text; result uuid; niche_limit int;
begin
  select plan into strict v_plan from public.profiles where id=p_user for update;
  niche_limit := case v_plan when 'agency' then 5 when 'lifetime' then 3 else 1 end;
  if p_id is null and (select count(*) from public.niches where user_id=p_user)>=niche_limit
    then raise exception 'Niche limit reached'; end if;
  if p_id is null then
    insert into public.niches(user_id,skill,keywords,negative_keywords,sources,min_intent,active,portfolio_url,pitch_style)
    values(p_user,p_data->>'skill',array(select jsonb_array_elements_text(p_data->'keywords')),
      array(select jsonb_array_elements_text(p_data->'negative_keywords')),array(select jsonb_array_elements_text(p_data->'sources')),
      (p_data->>'min_intent')::int,(p_data->>'active')::boolean,p_data->>'portfolio_url',p_data->>'pitch_style')
    returning id into result;
  else
    update public.niches set skill=p_data->>'skill',keywords=array(select jsonb_array_elements_text(p_data->'keywords')),
      negative_keywords=array(select jsonb_array_elements_text(p_data->'negative_keywords')),
      sources=array(select jsonb_array_elements_text(p_data->'sources')),min_intent=(p_data->>'min_intent')::int,
      active=(p_data->>'active')::boolean,portfolio_url=p_data->>'portfolio_url',pitch_style=p_data->>'pitch_style'
    where user_id=p_user and id=p_id returning id into strict result;
  end if;
  update public.profiles set onboarding_done=true where id=p_user;
  return result;
end $$;
