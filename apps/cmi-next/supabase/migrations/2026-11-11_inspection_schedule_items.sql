-- Inspection milestones, Step 3: loading library rows into a job's schedule.
-- Each loaded milestone remembers which library row it came from (the stable
-- step ID, e.g. SCOT-M07, plus its P00–P14 phase and the jurisdiction's code),
-- so loading again skips what's already there and reports line up across
-- jobs. inspection_status is read and written by Step 4 (status and hold
-- points); it stays empty until then. Run after 2026-11-11_inspection_settings.sql.

alter table public.schedule_items
  add column if not exists inspection_step_id text,
  add column if not exists inspection_phase_id text,
  add column if not exists inspection_code text,
  add column if not exists inspection_status text;

alter table public.schedule_items drop constraint if exists schedule_items_inspection_status_check;
alter table public.schedule_items add constraint schedule_items_inspection_status_check check (
  inspection_status is null or inspection_status in (
    'not_ready', 'ready_to_call', 'requested', 'scheduled', 'passed', 'partial', 'failed', 'reinspect_requested', 'na'
  )
);

create index if not exists schedule_items_inspection_step_idx
  on public.schedule_items (schedule_id, inspection_step_id) where inspection_step_id is not null;

comment on column public.schedule_items.inspection_step_id is 'Inspection library milestone this item was loaded from (e.g. SCOT-M07).';
comment on column public.schedule_items.inspection_phase_id is 'Library baseline phase P00–P14, for cross-jurisdiction reporting.';
comment on column public.schedule_items.inspection_code is 'Jurisdiction inspection number at load time, or "Per permit".';
comment on column public.schedule_items.inspection_status is 'Not Ready · Ready to Call · Requested · Scheduled · Passed · Partial · Failed / Correction · Re-inspect Requested · N/A (Step 4).';
