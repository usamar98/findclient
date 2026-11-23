create schema if not exists private;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade, email text not null, name text not null default '' check(length(name)<=100),
 plan text not null default 'free' check(plan in ('free','lifetime','agency')), credits integer not null default 15 check(credits>=0),
 telegram_chat_id text unique, onboarding_done boolean not null default false, digest_enabled boolean not null default false,
 branding text not null default '' check(length(branding)<=600), stripe_customer_id text, next_refill_at timestamptz
);
create table public.niches (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 skill text not null check(length(skill) between 2 and 100),keywords text[] not null,negative_keywords text[] not null default '{}',
 sources text[] not null check(cardinality(sources)>0 and sources <@ array['hn','bluesky','stackexchange','shopify','reddit','indiehackers','x','forums']), min_intent integer not null default 65 check(min_intent between 0 and 100),
 active boolean not null default true,portfolio_url text,pitch_style text not null default '',last_scanned_at timestamptz, unique(id,user_id)
);
create table public.leads (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,niche_id uuid not null,
 foreign key(niche_id,user_id) references public.niches(id,user_id) on delete cascade,
 source text not null,url text not null check(url ~ '^https?://'),author text,title text not null,body text not null default '',posted_at timestamptz not null,
 intent_score int not null check(intent_score between 0 and 100),intent_reason text not null,problem_summary text not null default '',budget_signal text,urgency text,
 status text not null default 'new' check(status in ('new','saved','replied','won','ignored')), created_at timestamptz not null default now(),
 unique(user_id,url),unique(id,user_id)
);
create index leads_inbox on public.leads(user_id,posted_at desc);
create table public.responses (
 id uuid primary key default gen_random_uuid(),lead_id uuid not null,user_id uuid not null,
 foreign key(lead_id,user_id) references public.leads(id,user_id) on delete cascade,
 solution_md text not null check(length(solution_md) between 1 and 16000),pitch_md text not null check(length(pitch_md) between 1 and 16000),tone text not null check(tone in ('friendly','expert','short')),created_at timestamptz not null default now()
);
create index responses_lead on public.responses(user_id,lead_id,created_at desc);
create table public.usage_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 settled_at timestamptz,request_key text not null,type text not null,cost_credits int not null check(cost_credits>=0),created_at timestamptz not null default now(), unique(user_id,request_key)
);
create table public.purchases (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 stripe_session_id text unique not null,product text not null,amount integer not null,created_at timestamptz not null default now()
);
create table public.checkout_quotes (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 product text not null,amount int not null,credits int not null,expires_at timestamptz not null,state text not null default 'open' check(state in ('open','paid','expired'))
);
create index checkout_open on public.checkout_quotes(product,state,expires_at);
create table public.product_config (product text primary key,price_cents int not null check(price_cents>0),credits int not null check(credits>0));
insert into public.product_config values ('lifetime',9900,150),('agency',19900,500),('topup9',900,100),('topup19',1900,250),('topup29',2900,400);
create table public.rate_limits (key text primary key,window_end timestamptz not null,hits int not null);
create table public.source_backoffs(source text primary key,retry_at timestamptz not null);
create table public.scan_jobs (
 id uuid primary key default gen_random_uuid(),
 niche_id uuid not null references public.niches on delete cascade,
 source text not null, scan_hour timestamptz not null, available_at timestamptz not null default now(),
 done_at timestamptz, lease uuid, attempts integer not null default 0,
 unique(niche_id,source,scan_hour)
);
create index scan_queue on public.scan_jobs(available_at,scan_hour) where done_at is null;
create index niches_owner on public.niches(user_id);
create table public.telegram_codes(code text primary key,user_id uuid not null unique references public.profiles on delete cascade,expires_at timestamptz not null);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 kind text not null,payload jsonb not null default '{}',event_key text not null unique,available_at timestamptz not null default now(),
 sent_at timestamptz, attempts int not null default 0
);
create index notifications_pending on public.notifications(available_at) where sent_at is null;
do $$ declare t text; begin
 foreach t in array array['profiles','niches','leads','responses','usage_events','purchases','checkout_quotes','product_config','rate_limits','source_backoffs','scan_jobs','telegram_codes','notifications'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public,anon,authenticated',t);
   execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['profiles','niches','leads','responses','usage_events','purchases'] loop
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy own_read on public.%I for select to authenticated using (%I=(select auth.uid()))',t,case when t='profiles' then 'id' else 'user_id' end);
 end loop;
end $$;
grant update (name,digest_enabled,branding) on public.profiles to authenticated;
grant update (status) on public.leads to authenticated;
grant update (solution_md,pitch_md) on public.responses to authenticated;
create policy profile_edit on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy lead_edit on public.leads for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy response_edit on public.responses for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function private.signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email) values(new.id,coalesce(new.email,''));
 insert into public.notifications(user_id,kind,event_key) values(new.id,'welcome','welcome:'||new.id);
 return new;
end $$;
create trigger on_signup after insert on auth.users for each row execute function private.signup();
create function private.keep_email() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.profiles set email=coalesce(new.email,'') where id=new.id;return new;end $$;
create trigger email_change after update of email on auth.users for each row execute function private.keep_email();
create function public.allow_request(p_key text,p_limit int,p_window int) returns boolean language sql as $$
 insert into public.rate_limits as lim values(p_key,now()+make_interval(secs=>p_window),1)
 on conflict(key) do update set hits=case when lim.window_end<=now() then 1 else lim.hits+1 end,
 window_end=case when lim.window_end<=now() then excluded.window_end else lim.window_end end returning hits<=p_limit
$$;
create function public.reserve_usage(p_user uuid,p_key text,p_type text,p_cost int) returns boolean language plpgsql as $$
begin
 if p_cost<1 then raise exception 'Invalid cost'; end if;
 perform 1 from public.profiles where id=p_user and credits>=p_cost for update;
 if not found then return false;end if;
 insert into public.usage_events(user_id,request_key,type,cost_credits) values(p_user,p_key,p_type,p_cost) on conflict do nothing;
 if not found then return false;end if;
 update public.profiles set credits=credits-p_cost where id=p_user;
 return true;
end $$;
create function public.refund_usage(p_user uuid,p_key text) returns void language plpgsql as $$
declare cost int;
begin
 perform 1 from public.profiles where id=p_user for update;
 delete from public.usage_events where user_id=p_user and request_key=p_key and settled_at is null returning cost_credits into cost;
 if found then update public.profiles set credits=credits+cost where id=p_user;end if;
end $$;
create index usage_pending on public.usage_events(created_at) where settled_at is null;
create function public.finalize_score(p_user uuid,p_key text,p_lead jsonb) returns boolean language plpgsql as $$
declare inserted boolean := false;
begin
 update public.usage_events set settled_at=now() where user_id=p_user and request_key=p_key and type='score' and settled_at is null;
 if not found then return false;end if;
 if p_lead is not null then
  insert into public.leads(user_id,niche_id,source,url,author,title,body,posted_at,intent_score,intent_reason,problem_summary,budget_signal,urgency)
  values(p_user,(p_lead->>'niche_id')::uuid,p_lead->>'source',p_lead->>'url',p_lead->>'author',p_lead->>'title',p_lead->>'body',(p_lead->>'posted_at')::timestamptz,(p_lead->>'intent_score')::int,p_lead->>'intent_reason',p_lead->>'problem_summary',p_lead->>'budget_signal',p_lead->>'urgency') on conflict(user_id,url) do nothing;
  inserted := found;
 end if;
 return inserted;
end $$;
create function public.finalize_reply(p_user uuid,p_key text,p_lead uuid,p_id uuid,p_tone text,p_solution text,p_pitch text) returns boolean language plpgsql as $$
begin
 update public.usage_events set settled_at=now() where user_id=p_user and request_key=p_key and type='response' and settled_at is null;
 if not found then return false;end if;
 insert into public.responses(id,user_id,lead_id,tone,solution_md,pitch_md) values(p_id,p_user,p_lead,p_tone,p_solution,p_pitch);
 return true;
end $$;
create function public.save_niche(p_user uuid,p_id uuid,p_data jsonb) returns uuid language plpgsql as $$
declare v_plan text; result uuid;
begin
 select plan into strict v_plan from public.profiles where id=p_user for update;
 if p_id is null and (select count(*) from public.niches where user_id=p_user)>=(case when v_plan='agency' then 5 else 1 end) then raise exception 'Niche limit reached'; end if;
 if p_id is null then
 insert into public.niches(user_id,skill,keywords,negative_keywords,sources,min_intent,active,portfolio_url,pitch_style)
 values(p_user,p_data->>'skill',array(select jsonb_array_elements_text(p_data->'keywords')),array(select jsonb_array_elements_text(p_data->'negative_keywords')),array(select jsonb_array_elements_text(p_data->'sources')),(p_data->>'min_intent')::int,(p_data->>'active')::boolean,p_data->>'portfolio_url',p_data->>'pitch_style') returning id into result;
 else
 update public.niches set skill=p_data->>'skill',keywords=array(select jsonb_array_elements_text(p_data->'keywords')),negative_keywords=array(select jsonb_array_elements_text(p_data->'negative_keywords')),sources=array(select jsonb_array_elements_text(p_data->'sources')), min_intent=(p_data->>'min_intent')::int,active=(p_data->>'active')::boolean, portfolio_url=p_data->>'portfolio_url',pitch_style=p_data->>'pitch_style' where user_id=p_user and id=p_id returning id into strict result;
 end if;
 update public.profiles set onboarding_done=true where id=p_user;
 return result;
end $$;
create function public.lifetime_price() returns table(sales int,price int,spots int) language sql stable as $$
 with c as (select count(*)::int n from public.purchases where product='lifetime')
 select n,(select price_cents from public.product_config where product='lifetime')/100+case when n<25 then 0 else 10*(1+(n-25)/5) end,
 case when n<25 then 25-n else 5-(n-25)%5 end from c
$$;
create function public.create_quote(p_user uuid,p_product text) returns public.checkout_quotes language plpgsql as $$
declare item public.product_config;quote public.checkout_quotes; tier record; current_plan text;
begin
 select plan into strict current_plan from public.profiles where id=p_user for update;
 if p_product='lifetime' and current_plan<>'free' or p_product='agency' and current_plan='agency' then raise exception 'Plan already owned'; end if;
 select * into strict item from public.product_config where product=p_product for update;
 if p_product in ('lifetime','agency') and exists(select 1 from public.checkout_quotes where user_id=p_user and product in ('lifetime','agency') and state='open') then raise exception 'A plan checkout is already open';end if;
 if p_product='lifetime' then
 select * into tier from public.lifetime_price();
 if (select count(*) from public.checkout_quotes where product=p_product and state='open') >=tier.spots then raise exception 'Remaining spots are currently in checkout'; end if;
 item.price_cents=tier.price*100;
 end if;
 insert into public.checkout_quotes(user_id,product,amount,credits,expires_at) values(p_user,p_product,item.price_cents,item.credits,now()+interval '35 minutes') returning * into quote;
 return quote;
end $$;
create function public.fulfill_checkout(p_quote uuid,p_session text,p_amount int,p_user uuid,p_customer text) returns boolean language plpgsql as $$
declare q public.checkout_quotes;
begin
 perform 1 from public.profiles where id=p_user for update;
 select * into strict q from public.checkout_quotes where id=p_quote and user_id=p_user for update;
 if exists(select 1 from public.profiles where id=p_user and stripe_customer_id is not null and stripe_customer_id<>p_customer) then raise exception 'Customer mismatch'; end if;
 if q.amount<>p_amount then raise exception 'Payment amount mismatch';end if;
 if q.state='paid' and exists(select 1 from public.purchases where stripe_session_id=p_session and user_id=p_user) then return false; end if;
 if q.state<>'open' then raise exception 'Quote state mismatch'; end if;
 perform 1 from public.product_config where product=q.product for update;
 insert into public.purchases(user_id,stripe_session_id,product,amount) values(q.user_id,p_session,q.product,q.amount);
 update public.checkout_quotes set state='paid' where id=q.id;
 update public.profiles set credits=credits+q.credits,stripe_customer_id=coalesce(stripe_customer_id,p_customer),
 plan=case when q.product='agency' then 'agency' when q.product='lifetime' and plan='free' then 'lifetime' else plan end,
 next_refill_at=case when q.product in ('agency','lifetime') then now()+interval '1 month' else next_refill_at end where id=q.user_id;
 insert into public.notifications(user_id,kind,event_key,payload) values(q.user_id,'receipt','receipt:'||p_session,jsonb_build_object('product',q.product,'amount',q.amount));
 return true;
end $$;
create function public.enqueue_scans() returns int language plpgsql as $$
declare queued integer;
begin
 insert into public.scan_jobs(niche_id,source,scan_hour)
 select n.id,source,date_trunc('hour',now())
 from public.niches n join public.profiles p on p.id=n.user_id cross join lateral unnest(n.sources) source
 where n.active and p.credits>0
 on conflict(niche_id,source,scan_hour) do nothing;
 get diagnostics queued=row_count;
 return queued;
end $$;
create function public.claim_scan_jobs(p_limit int) returns setof public.scan_jobs language sql as $$
 with batch as (
 select j.id from public.scan_jobs j
 where j.done_at is null and j.available_at<=now() and j.scan_hour>=date_trunc('hour',now())-interval '6 hours'
 and not exists(select 1 from public.source_backoffs b where b.source=case when j.source in ('reddit','x','forums','indiehackers') then 'exa' else j.source end and b.retry_at>now())
 order by j.scan_hour,j.available_at,j.id for update skip locked limit p_limit
 )
 update public.scan_jobs j set lease=gen_random_uuid(),available_at=now()+interval '6 minutes',attempts=j.attempts+1
 from batch where j.id=batch.id returning j.*
$$;
create function public.defer_source(p_source text,p_until timestamptz) returns void language sql as $$
 insert into public.source_backoffs(source,retry_at) values(p_source,p_until)
 on conflict(source) do update set retry_at=greatest(excluded.retry_at,public.source_backoffs.retry_at)
$$;
create function public.refill_credits() returns void language plpgsql as $$
declare orphan record;
begin
 for orphan in select user_id,request_key from public.usage_events where settled_at is null and created_at<now()-interval '30 minutes' order by user_id,request_key limit 5000 loop
   perform public.refund_usage(orphan.user_id,orphan.request_key);
 end loop;
 update public.profiles p set credits=p.credits+c.credits,next_refill_at=p.next_refill_at+interval '1 month' from public.product_config c where c.product=p.plan and p.plan in ('lifetime','agency') and p.next_refill_at<=now();
 delete from public.scan_jobs where scan_hour<now()-interval '1 day';
 delete from public.rate_limits where window_end<now()-interval '1 day';
 delete from public.telegram_codes where expires_at<now();
end $$;
create function private.credit_alert() returns trigger language plpgsql as $$
begin
 if old.credits>3 and new.credits<=3 then insert into public.notifications(user_id,kind,event_key) values(new.id,'low','low:'||gen_random_uuid());end if;return new;
end $$;
create trigger on_balance after update of credits on public.profiles for each row execute function private.credit_alert();
create function private.lead_alert() returns trigger language plpgsql as $$
begin
 if new.intent_score>=80 and exists(select 1 from public.profiles where id=new.user_id and telegram_chat_id is not null) then
 insert into public.notifications(user_id,kind,event_key,payload) values(new.user_id,'telegram','lead:'||new.id,jsonb_build_object('id',new.id,'title',new.title,'score',new.intent_score));
 end if;return new;
end $$;
create trigger on_lead after insert on public.leads for each row execute function private.lead_alert();
create function public.link_telegram(p_code text,p_chat text) returns boolean language plpgsql as $$
declare owner_id uuid;
begin delete from public.telegram_codes where code=p_code and expires_at>now() returning user_id into owner_id;
 if not found then return false;end if;update public.profiles set telegram_chat_id=p_chat where id=owner_id;return true;end $$;
create function public.queue_digests() returns void language sql as $$
 insert into public.notifications(user_id,kind,event_key,payload)
 select p.id,'digest','digest:'||p.id||':'||current_date,jsonb_build_object('leads',items.val)
 from public.profiles p cross join lateral (select jsonb_agg(x) val from (select id,title,intent_score from public.leads where user_id=p.id and created_at>=now()-interval '24 hours' order by intent_score desc limit 5)x) items
 where p.digest_enabled and items.val is not null on conflict(event_key) do nothing
$$;
create function public.claim_notifications(p_limit int) returns setof public.notifications language sql as $$
 with locked as (select id from public.notifications where sent_at is null and available_at<=now() order by available_at for update skip locked limit p_limit)
 update public.notifications n set available_at=now()+interval '10 minutes',attempts=attempts+1 from locked where n.id=locked.id returning n.*
$$;
do $$ declare f regprocedure;begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('allow_request','reserve_usage','refund_usage','finalize_score','finalize_reply','save_niche','lifetime_price','create_quote','fulfill_checkout','enqueue_scans','claim_scan_jobs','defer_source','refill_credits','link_telegram','queue_digests','claim_notifications') loop
 execute format('revoke execute on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
