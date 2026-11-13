-- Schedule grid layouts (Grid Behavior Addendum §3.3, Step D).
-- A layout is the grid's columns (order, width, shown), the Split / Grid / Gantt
-- choice, the divider position and the Gantt zoom.
--
--   schedule_grid_layouts  layouts a person saves by name ("Ben – procurement"),
--                          for one schedule type or for every type; one of them
--                          can be their default for that type.
--   schedule_grid_state    the layout each person last used on each schedule.
--
-- When a schedule opens: the person's last layout on it → their default for the
-- schedule's type (or for every type) → the Default preset. Built-in presets
-- (Default, Field, Links, Client print, Minimal…) live in code, not here.
--
-- RLS on with no policies: only the app's server (service role) reads and writes,
-- and it scopes every query to the signed-in staff user.

create table if not exists public.schedule_grid_layouts (
  id             uuid primary key default gen_random_uuid(),
  staff_user_id  uuid not null references public.staff_users(id) on delete cascade,
  -- null = every schedule type; otherwise construction, design, permit…
  schedule_type  text,
  name           text not null check (char_length(btrim(name)) between 1 and 60),
  -- [{ "key": "start", "width": 108, "visible": true }, …] in order
  columns        jsonb not null default '[]'::jsonb check (jsonb_typeof(columns) = 'array'),
  split          text not null default 'split' check (split in ('split', 'grid', 'gantt')),
  divider_pct    numeric(5,2) check (divider_pct is null or (divider_pct >= 0 and divider_pct <= 100)),
  gantt_zoom     text check (gantt_zoom is null or gantt_zoom in ('day', 'week', 'month')),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One layout per name, per person, per type (null type counts as its own type).
create unique index if not exists schedule_grid_layouts_name_uq
  on public.schedule_grid_layouts (staff_user_id, coalesce(schedule_type, ''), lower(btrim(name)));
-- At most one default per person per type.
create unique index if not exists schedule_grid_layouts_default_uq
  on public.schedule_grid_layouts (staff_user_id, coalesce(schedule_type, ''))
  where is_default;

drop trigger if exists schedule_grid_layouts_updated_at on public.schedule_grid_layouts;
create trigger schedule_grid_layouts_updated_at
  before update on public.schedule_grid_layouts
  for each row execute function public.set_updated_at();

alter table public.schedule_grid_layouts enable row level security;

comment on table public.schedule_grid_layouts is 'Schedule grid layouts saved by name per staff user (Grid Addendum §3.3).';
comment on column public.schedule_grid_layouts.schedule_type is 'null = every schedule type.';
comment on column public.schedule_grid_layouts.columns is 'Ordered [{key, width, visible}]; activity_id and name are always first and shown.';

create table if not exists public.schedule_grid_state (
  staff_user_id  uuid not null references public.staff_users(id) on delete cascade,
  schedule_id    uuid not null references public.job_schedules(id) on delete cascade,
  -- The preset or saved layout it came from (shown on the Columns button); null = changed by hand.
  layout_name    text check (layout_name is null or char_length(layout_name) <= 60),
  columns        jsonb not null default '[]'::jsonb check (jsonb_typeof(columns) = 'array'),
  split          text not null default 'split' check (split in ('split', 'grid', 'gantt')),
  divider_pct    numeric(5,2) check (divider_pct is null or (divider_pct >= 0 and divider_pct <= 100)),
  gantt_zoom     text check (gantt_zoom is null or gantt_zoom in ('day', 'week', 'month')),
  updated_at     timestamptz not null default now(),
  primary key (staff_user_id, schedule_id)
);

-- The primary key covers lookups by person; this covers the schedule foreign key (cascade deletes).
create index if not exists schedule_grid_state_schedule_idx on public.schedule_grid_state (schedule_id);

drop trigger if exists schedule_grid_state_updated_at on public.schedule_grid_state;
create trigger schedule_grid_state_updated_at
  before update on public.schedule_grid_state
  for each row execute function public.set_updated_at();

alter table public.schedule_grid_state enable row level security;

comment on table public.schedule_grid_state is 'The grid layout each staff user last used on each schedule (Grid Addendum §3.3).';
