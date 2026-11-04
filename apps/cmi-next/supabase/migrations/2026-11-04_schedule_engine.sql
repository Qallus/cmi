-- Schedule engine, Phase 1 (docs/schedule/CMI_Scheduling-Spec_R2_Response_2026-11-04.md):
-- work calendars, activity IDs, constraints, actuals, critical-path results,
-- milestone types / contract dates, numbered baselines. Additive only: with
-- the schedule_engine flag off and every schedule left in 'legacy' mode, the
-- dashboard behaves exactly as before. Run after 2026-11-04_schedule_base.sql.

-- ── Calendars: company → job (or schedule, for deal / Pre-Con / selection
--    schedules with no job). A null workdays inherits from the level above.
create table if not exists public.schedule_calendars (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('company','job','schedule')),
  scope_id uuid,
  name text not null default 'Calendar',
  workdays jsonb,
  -- [{date: 'YYYY-MM-DD', working: bool, type: holiday|weather|jurisdiction|owner|other, label}]
  exceptions jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_calendars_scope_id_check check ((scope = 'company') = (scope_id is null))
);
create unique index if not exists schedule_calendars_scope_idx
  on public.schedule_calendars (scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.schedule_calendars enable row level security;

-- Company calendar: Mon–Fri plus CMI's observed weekday holidays for 2026–27
-- (Spec R2 §5). Admins maintain it in Settings → Scheduling.
insert into public.schedule_calendars (scope, scope_id, name, workdays, exceptions)
values ('company', null, 'CMI company calendar',
  '{"mon": true, "tue": true, "wed": true, "thu": true, "fri": true, "sat": false, "sun": false}'::jsonb,
  '[{"date":"2026-01-01","working":false,"type":"holiday","label":"New Year''s Day"},{"date":"2026-05-25","working":false,"type":"holiday","label":"Memorial Day"},{"date":"2026-09-07","working":false,"type":"holiday","label":"Labor Day"},{"date":"2026-11-26","working":false,"type":"holiday","label":"Thanksgiving"},{"date":"2026-11-27","working":false,"type":"holiday","label":"Day after Thanksgiving"},{"date":"2026-12-24","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2026-12-25","working":false,"type":"holiday","label":"Christmas Day"},{"date":"2026-12-28","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2026-12-29","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2026-12-30","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2026-12-31","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2027-01-01","working":false,"type":"holiday","label":"New Year''s Day"},{"date":"2027-05-31","working":false,"type":"holiday","label":"Memorial Day"},{"date":"2027-09-06","working":false,"type":"holiday","label":"Labor Day"},{"date":"2027-11-25","working":false,"type":"holiday","label":"Thanksgiving"},{"date":"2027-11-26","working":false,"type":"holiday","label":"Day after Thanksgiving"},{"date":"2027-12-24","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2027-12-27","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2027-12-28","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2027-12-29","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2027-12-30","working":false,"type":"holiday","label":"Holiday shutdown"},{"date":"2027-12-31","working":false,"type":"holiday","label":"Holiday shutdown"}]'::jsonb)
on conflict do nothing;

-- ── Schedules: how dates are calculated, and the weekly status date.
--    legacy = today's forward push (default, unchanged); auto = critical path
--    moves dates both ways; manual = nothing moves, float is advisory.
alter table public.job_schedules
  add column if not exists scheduling_mode text not null default 'legacy',
  add column if not exists status_date date,
  add column if not exists engine_finish date,
  add column if not exists engine_ran_at timestamptz;
do $$ begin
  alter table public.job_schedules add constraint job_schedules_scheduling_mode_check
    check (scheduling_mode in ('legacy','auto','manual'));
exception when duplicate_object then null; end $$;

-- ── Tasks.
alter table public.schedule_items
  add column if not exists activity_id integer,
  add column if not exists wbs text,
  add column if not exists duration_unit text not null default 'workdays',
  add column if not exists constraint_type text,
  add column if not exists constraint_date date,
  add column if not exists actual_start date,
  add column if not exists actual_finish date,
  add column if not exists remaining_duration numeric,
  add column if not exists early_start date,
  add column if not exists early_finish date,
  add column if not exists late_start date,
  add column if not exists late_finish date,
  add column if not exists total_float integer,
  add column if not exists free_float integer,
  add column if not exists milestone_type text,
  add column if not exists contract_date date,
  add column if not exists cost_code text;
do $$ begin
  alter table public.schedule_items add constraint schedule_items_duration_unit_check
    check (duration_unit in ('workdays','calendar'));
exception when duplicate_object then null; end $$;
do $$ begin
  -- Locked stays on is_locked; the engine treats it as a hard date.
  alter table public.schedule_items add constraint schedule_items_constraint_type_check
    check (constraint_type is null or constraint_type in ('snet','mfo','alap'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.schedule_items add constraint schedule_items_milestone_type_check
    check (milestone_type is null or milestone_type in ('contract','inspection','client_decision','internal'));
exception when duplicate_object then null; end $$;

-- Activity IDs by tens in each schedule's current order (10, 20, 30…).
update public.schedule_items si set activity_id = n.rn * 10
from (
  select id, row_number() over (partition by schedule_id order by sort_order, start_date nulls last, created_at) as rn
  from public.schedule_items
) n
where si.id = n.id and si.activity_id is null;
create unique index if not exists schedule_items_activity_idx on public.schedule_items (schedule_id, activity_id);

-- ── Baselines: numbered (0 = at contract) and keep the calendar they were
--    captured on, so a holiday added later doesn't skew the comparison.
alter table public.schedule_baselines
  add column if not exists number integer,
  add column if not exists calendar_snapshot jsonb;
update public.schedule_baselines b set number = n.rn - 1
from (select id, row_number() over (partition by schedule_id order by created_at) as rn from public.schedule_baselines) n
where b.id = n.id and b.number is null;

-- ── Off until approved.
insert into public.feature_flags (key, enabled, description)
values ('schedule_engine', false, 'Schedules: critical path engine, work calendars, grid editor and Excel (Spec R2 Phase 1)')
on conflict (key) do nothing;
