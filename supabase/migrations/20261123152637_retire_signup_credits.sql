-- Apply only to newly created profiles; existing balances belong to their owners.
alter table public.profiles alter column credits set default 0;
