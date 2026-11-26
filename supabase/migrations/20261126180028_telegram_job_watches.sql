begin;

create table public.telegram_job_watches (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  chat_id text not null,
  query text not null check (query = btrim(query) and (query = '' or length(query) between 2 and 100)),
  started_at timestamptz not null default now(),
  next_check_at timestamptz not null default now()
);
create index telegram_job_watches_due on public.telegram_job_watches(next_check_at, user_id);
alter table public.telegram_job_watches enable row level security;
revoke all on public.telegram_job_watches from public, anon, authenticated;
grant select, insert, update, delete on public.telegram_job_watches to service_role;

create function public.set_telegram_job_watch(p_user uuid, p_chat text, p_query text)
returns void language plpgsql set search_path = '' as $$
begin
  -- Serialise changes with account linking and unlinking.
  perform 1 from public.profiles where id = p_user and telegram_chat_id = p_chat for update;
  if not found then
    raise exception 'This Telegram chat is not linked to the account';
  end if;
  if p_query is null then
    delete from public.telegram_job_watches where user_id = p_user;
    return;
  end if;
  insert into public.telegram_job_watches as w (user_id, chat_id, query)
    values (p_user, p_chat, btrim(p_query))
  on conflict (user_id) do update set
    chat_id = excluded.chat_id, query = excluded.query, id = gen_random_uuid(),
    started_at = now(), next_check_at = now()
  where (w.chat_id, w.query) is distinct from (excluded.chat_id, excluded.query);
end;
$$;

create function public.claim_telegram_job_watches(p_limit integer)
returns setof public.telegram_job_watches language sql set search_path = '' as $$
  with due as (
    select user_id from public.telegram_job_watches
    where next_check_at <= now()
    order by next_check_at, user_id
    for update skip locked limit greatest(0, least(coalesce(p_limit, 0), 100))
  )
  update public.telegram_job_watches as w
    set next_check_at = now() + interval '9 minutes'
    from due where w.user_id = due.user_id returning w.*;
$$;

create function private.clear_telegram_job_watch() returns trigger
language plpgsql set search_path = '' as $$
begin
  delete from public.telegram_job_watches where user_id = new.id;
  return new;
end;
$$;
create trigger clear_telegram_job_watch after update of telegram_chat_id on public.profiles
  for each row when (old.telegram_chat_id is distinct from new.telegram_chat_id)
  execute function private.clear_telegram_job_watch();

revoke all on function private.clear_telegram_job_watch() from public, anon, authenticated;
revoke all on function public.set_telegram_job_watch(uuid, text, text),
  public.claim_telegram_job_watches(integer) from public, anon, authenticated;
grant execute on function public.set_telegram_job_watch(uuid, text, text),
  public.claim_telegram_job_watches(integer) to service_role;

commit;
