-- Schedule Builder: schedules for more than jobs, schedules inside schedules,
-- and schedule items that point at any dashboard record.
-- Plan: docs/features/schedule-builder/schedule-builder-plan.md
--
-- • A schedule now belongs to a scope: a job (as before), a Pipeline deal, a
--   Pre-Con record or a selection. job_id stays set for job schedules, so
--   everything that reads schedules by job keeps working.
-- • parent_schedule_id nests schedules any number of levels deep (Master →
--   Customer / Vendor / Trade Partner, or Install → Electrical / Windows / Doors).
--   Deleting a schedule deletes the schedules inside it.
-- • link_type / link_id / link_label on an item point it at a record (a deal,
--   job, Pre-Con, company, contact, selection, project, punch list or another
--   schedule), so "what's scheduled for this vendor" is one indexed query.
-- • The feature flag schedule_builder (off) gates the new UI.
-- Idempotent; safe to re-run.

alter table public.job_schedules alter column job_id drop not null;

alter table public.job_schedules
  add column if not exists parent_schedule_id uuid references public.job_schedules(id) on delete cascade,
  add column if not exists scope_type text not null default 'job',
  add column if not exists scope_id uuid;

update public.job_schedules set scope_id = job_id where scope_id is null and scope_type = 'job';

do $$ begin
  alter table public.job_schedules add constraint job_schedules_scope_type_check
    check (scope_type in ('job', 'deal', 'precon', 'selection'));
exception when duplicate_object then null; end $$;

do $$ begin
  -- A job schedule's scope is its job; other scopes have no job.
  alter table public.job_schedules add constraint job_schedules_scope_job_check
    check ((scope_type = 'job' and job_id is not null and scope_id = job_id) or (scope_type <> 'job' and job_id is null and scope_id is not null));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.job_schedules add constraint job_schedules_not_own_parent
    check (parent_schedule_id is null or parent_schedule_id <> id);
exception when duplicate_object then null; end $$;

create index if not exists job_schedules_scope_idx on public.job_schedules (scope_type, scope_id);
create index if not exists job_schedules_parent_idx on public.job_schedules (parent_schedule_id);

alter table public.schedule_items
  add column if not exists link_type text,
  add column if not exists link_id uuid,
  add column if not exists link_label text;

do $$ begin
  alter table public.schedule_items add constraint schedule_items_link_type_check
    check (link_type is null or link_type in ('deal', 'job', 'precon', 'company', 'contact', 'selection', 'project', 'punch_list', 'schedule'));
exception when duplicate_object then null; end $$;

create index if not exists schedule_items_link_idx on public.schedule_items (link_type, link_id) where link_id is not null;

insert into public.feature_flags (key, enabled, description)
values ('schedule_builder', false, 'Schedule Builder: schedules for deals, Pre-Con and selections, schedules inside schedules, and items linked to any record.')
on conflict (key) do nothing;
