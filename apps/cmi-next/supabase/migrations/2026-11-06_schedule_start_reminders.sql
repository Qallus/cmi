-- Schedules Phase 2 Step 6 (Spec R2 §7.6): remind staff assignees N working
-- days before a task starts (default 5, set per job). Behind schedule_progress.
--   • schedule_notifications gains the 'starting' kind (bell + push).
--   • jobs.schedule_reminder_days: working days ahead to remind (0 = off).

alter table public.schedule_notifications drop constraint if exists schedule_notifications_kind_check;
alter table public.schedule_notifications add constraint schedule_notifications_kind_check
  check (kind = any (array['assigned', 'moved', 'due', 'status', 'starting']));

alter table public.jobs
  add column if not exists schedule_reminder_days integer not null default 5;
alter table public.jobs drop constraint if exists jobs_schedule_reminder_days_check;
alter table public.jobs add constraint jobs_schedule_reminder_days_check check (schedule_reminder_days between 0 and 30);
comment on column public.jobs.schedule_reminder_days is 'Working days before a scheduled task starts to remind its staff assignees (0 = no reminder).';
