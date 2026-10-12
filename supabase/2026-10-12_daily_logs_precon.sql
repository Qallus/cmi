-- Daily logs for Pre-Con work too, not only Jobs.
--
-- Site visits, walk-throughs and surveys happen before a deal becomes a job,
-- so a log can now belong to a Pre-Con opportunity instead. Exactly one of
-- job_id / opportunity_id is required.
alter table public.daily_logs
  add column if not exists opportunity_id uuid references public.pipeline_opportunities(id) on delete cascade;

alter table public.daily_logs alter column job_id drop not null;

alter table public.daily_logs drop constraint if exists daily_logs_has_target;
alter table public.daily_logs
  add constraint daily_logs_has_target check (job_id is not null or opportunity_id is not null);

create index if not exists daily_logs_opportunity_idx on public.daily_logs (opportunity_id, log_date desc)
  where opportunity_id is not null;
