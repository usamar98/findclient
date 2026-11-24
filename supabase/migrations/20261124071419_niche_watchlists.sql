create function private.valid_watches(entries text[], pattern text)
returns boolean language sql immutable strict set search_path='' as $$
  select cardinality(entries) <= 10 and coalesce(array_ndims(entries),1)=1
    and not exists(select 1 from unnest(entries) e where e is null or e !~ pattern)
$$;
alter table public.niches
  add column hn_threads text[] not null default '{}' check(private.valid_watches(hn_threads,'^[1-9][0-9]{0,11}$')),
  add column subreddits text[] not null default '{}' check(private.valid_watches(subreddits,'^[a-z0-9][a-z0-9_]{0,20}$'));

-- Reuse the existing quota, lock and ownership checks within the same transaction.
alter function public.save_niche(uuid,uuid,jsonb) set schema private;
create function public.save_niche(p_user uuid,p_id uuid,p_data jsonb)
returns uuid language plpgsql set search_path='' as $$
declare result uuid;
begin
  result := private.save_niche(p_user,p_id,p_data);
  if p_data ? 'hn_threads' or p_data ? 'subreddits' then
    update public.niches set
      hn_threads=case when p_data ? 'hn_threads' then array(select jsonb_array_elements_text(p_data->'hn_threads')) else hn_threads end,
      subreddits=case when p_data ? 'subreddits' then array(select jsonb_array_elements_text(p_data->'subreddits')) else subreddits end
    where id=result and user_id=p_user;
  end if;
  return result;
end $$;
grant usage on schema private to service_role;
revoke all on function public.save_niche(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_niche(uuid,uuid,jsonb) to service_role;
