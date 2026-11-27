begin;

alter table public.shared_hiring_jobs
  drop constraint shared_hiring_jobs_source_check,
  add constraint shared_hiring_jobs_source_check check (
    source in ('hn', 'bluesky', 'weworkremotely', 'remoteok', 'github', 'mastodon', 'jobicy', 'jobtech')
  );

commit;
