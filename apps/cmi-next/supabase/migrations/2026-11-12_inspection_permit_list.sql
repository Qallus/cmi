-- Inspection milestones, Step 5: the permit list wins. The job keeps the
-- inspection list pasted from the permit and when (and by whom) the schedule's
-- inspections were checked against it. Run after 2026-11-11_inspection_schedule_items.sql.

alter table public.jobs
  add column if not exists inspection_permit_list text,
  add column if not exists inspection_list_verified_on date,
  add column if not exists inspection_list_verified_by uuid references public.staff_users(id) on delete set null;

comment on column public.jobs.inspection_permit_list is 'The inspection list as printed on the permit (pasted by the PM).';
comment on column public.jobs.inspection_list_verified_on is 'Date the schedule''s inspections were last reconciled with the permit list.';
comment on column public.jobs.inspection_list_verified_by is 'Who reconciled them.';
