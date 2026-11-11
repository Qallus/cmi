-- Inspection milestones, Steps 1–2 (docs/features/schedule-builder/inspection-milestones-plan.md).
-- Brandon's Inspection Milestone Library: 314 zero-duration milestones across nine
-- jurisdictions, plus the jurisdiction details (how to schedule, next-day cutoffs)
-- and the map from each library work-task hook to a CMI template task. A job gets
-- its jurisdiction (by parcel), scope (NEW / ADD / REN) and site conditions, which
-- pick the library rows when inspections are added to its schedule (Step 3).
-- Data is loaded by 2026-11-11_inspection_milestones_seed.sql. Behind the
-- inspection_milestones flag (off). Run this file first, then the seed.

create table if not exists public.inspection_jurisdictions (
  code text primary key,                       -- SCOT, PHX, PV, MESA, TMP, CHD, CC, CF, MCO (the library's ID prefix)
  name text not null,
  sort_order integer not null default 0,
  scheduling_method text,
  portal_url text,
  phone text,
  -- Next-business-day cutoff, minutes after midnight the day before (1440 = midnight). Null = not published.
  cutoff_minutes integer check (cutoff_minutes is null or cutoff_minutes between 0 and 1440),
  cutoff_label text,
  inspection_hours text,
  notes text,
  verified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.inspection_jurisdictions is 'Building jurisdictions in the inspection library: how to request inspections and the next-day cutoff.';

create table if not exists public.inspection_library (
  milestone_id text primary key,               -- e.g. SCOT-M07: the stable key
  jurisdiction_code text not null references public.inspection_jurisdictions(code) on update cascade,
  sort_order integer not null default 0,       -- order within the workbook
  phase_id text not null check (phase_id ~ '^P[0-9]{2}$'),  -- P00–P14 baseline phase
  phase text,
  doc_step text,                               -- step in the Template Reference doc (SCOT-03), if any
  gantt_name text not null,                    -- schedule item name, e.g. "INSP · Footing / UFER"
  jurisdiction_name text,                      -- what the jurisdiction calls it
  code text,                                   -- inspection number, or "Per permit"
  code_basis text,
  milestone_type text not null check (milestone_type in ('inspection', 'internal', 'contract')),
  -- Scope columns as written in the workbook: "Y", "If CMU", "As needed", "—".
  scope_new text,
  scope_add text,
  scope_ren text,
  include_when text,
  predecessor_hook text,                       -- work task before it (Finish→Start, lag 0)
  released_hook text,                          -- work task it releases (Finish→Start, lag 0)
  hold_point boolean not null default true,
  request_rule text,
  ready_checklist text,
  repeats text,                                -- e.g. "Per pour", "Per grout lift"; empty = once
  show_on_master text,
  notes text,
  verified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inspection_library_jurisdiction_idx on public.inspection_library (jurisdiction_code, sort_order);
comment on table public.inspection_library is 'Brandon''s Inspection Milestone Library (Milestone Library tab). One row per zero-duration milestone; the issued permit''s list overrides it.';

create table if not exists public.inspection_task_hooks (
  phase_id text not null,
  hook text not null,                          -- work-task text used in the library
  role text not null check (role in ('predecessor', 'released')),
  match_kind text not null check (match_kind in ('task', 'add', 'milestone', 'unmapped')),
  template_task text,                          -- task title in the CMI template (task), proposed task (add) or milestone (milestone)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (phase_id, hook, role)
);
comment on table public.inspection_task_hooks is 'Library work-task hooks mapped to CMI New Construction template tasks (Work Task Hooks tab, column D).';

-- Service role only, like the other schedule tables.
alter table public.inspection_jurisdictions enable row level security;
alter table public.inspection_library enable row level security;
alter table public.inspection_task_hooks enable row level security;

-- The job's inspection profile (Step 2).
alter table public.jobs
  add column if not exists jurisdiction_code text references public.inspection_jurisdictions(code) on update cascade,
  add column if not exists inspection_scope text,
  add column if not exists inspection_conditions text[] not null default '{}';
alter table public.jobs drop constraint if exists jobs_inspection_scope_check;
alter table public.jobs add constraint jobs_inspection_scope_check check (inspection_scope is null or inspection_scope in ('NEW', 'ADD', 'REN'));
comment on column public.jobs.jurisdiction_code is 'Building jurisdiction, assigned by parcel (not mailing address). Picks the inspection library rows.';
comment on column public.jobs.inspection_scope is 'NEW = new home or guest house; ADD = addition or large renovation with structural / exterior work; REN = interior renovation, no new foundation or site work.';
comment on column public.jobs.inspection_conditions is 'Conditions that switch on "If …" library rows (lib/inspections/conditions.ts keys).';

insert into public.feature_flags (key, enabled, description)
values ('inspection_milestones', false, 'Schedules: municipal inspection milestones from the inspection library (job jurisdiction, scope and conditions; loading inspections into schedules, status and hold points)')
on conflict (key) do nothing;
