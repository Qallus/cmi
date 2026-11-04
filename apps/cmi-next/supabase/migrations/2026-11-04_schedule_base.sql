-- Schedules: baseline of the tables as they exist in production (captured
-- 2026-11-04 from information_schema / pg_constraint / pg_indexes). These
-- tables were created outside the repo; this file lets a fresh database be
-- built from the repo. Safe to run on production: everything is IF NOT EXISTS.
-- Later changes: 2026-10-30_schedule_builder.sql, 2026-11-04_schedule_engine.sql.

create table if not exists public.job_schedules (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  name text not null,
  type text not null default 'construction',
  description text,
  owner_id uuid references public.staff_users(id) on delete set null,
  manager_id uuid references public.staff_users(id) on delete set null,
  start_date date,
  target_completion date,
  projected_completion date,
  status text not null default 'active' check (status in ('active','on_hold','complete','archived')),
  priority text not null default 'normal',
  progress integer not null default 0,
  health text not null default 'on_track' check (health in ('on_track','watch','at_risk','delayed','critical')),
  is_master boolean not null default false,
  visibility text not null default 'internal',
  workdays jsonb not null default '{"mon": true, "tue": true, "wed": true, "thu": true, "fri": true, "sat": false, "sun": false}'::jsonb,
  color text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid references public.staff_users(id) on delete set null,
  updated_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  parent_schedule_id uuid references public.job_schedules(id) on delete cascade,
  scope_type text not null default 'job' check (scope_type in ('job','deal','precon','selection')),
  scope_id uuid,
  constraint job_schedules_not_own_parent check (parent_schedule_id is null or parent_schedule_id <> id),
  constraint job_schedules_scope_job_check check (
    (scope_type = 'job' and job_id is not null and scope_id = job_id)
    or (scope_type <> 'job' and job_id is null and scope_id is not null))
);
create index if not exists job_schedules_job_idx on public.job_schedules (job_id);
create unique index if not exists job_schedules_one_master_idx on public.job_schedules (job_id) where is_master;
create index if not exists job_schedules_parent_idx on public.job_schedules (parent_schedule_id);
create index if not exists job_schedules_scope_idx on public.job_schedules (scope_type, scope_id);
create index if not exists job_schedules_status_idx on public.job_schedules (status);

create table if not exists public.schedule_phases (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.job_schedules(id) on delete cascade,
  name text not null,
  owner_id uuid references public.staff_users(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'not_started',
  progress integer not null default 0,
  visibility text not null default 'inherit',
  health text,
  color text,
  collapsed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists schedule_phases_schedule_idx on public.schedule_phases (schedule_id);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.job_schedules(id) on delete cascade,
  phase_id uuid references public.schedule_phases(id) on delete set null,
  job_id uuid references public.jobs(id) on delete cascade,
  kind text not null default 'task' check (kind in ('task','milestone')),
  title text not null,
  description text,
  status text not null default 'not_started',
  priority text not null default 'normal',
  start_date date,
  end_date date,
  start_time text,
  end_time text,
  all_day boolean not null default true,
  duration_days numeric,
  percent_complete integer not null default 0,
  assignees jsonb not null default '[]'::jsonb,
  responsible_company text,
  client_visible boolean not null default false,
  confirmation_required boolean not null default false,
  tags jsonb not null default '[]'::jsonb,
  location text,
  internal_notes text,
  client_notes text,
  is_critical boolean not null default false,
  is_locked boolean not null default false,
  baseline_start date,
  baseline_end date,
  recurrence jsonb,
  relationships jsonb not null default '{}'::jsonb,
  milestone_kind text,
  master_display text not null default 'inherit'
    check (master_display in ('inherit','do_not_show','milestone_only','show_when_critical','always_show')),
  sort_order integer not null default 0,
  created_by uuid references public.staff_users(id) on delete set null,
  updated_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  link_type text check (link_type is null or link_type in ('deal','job','precon','company','contact','selection','project','punch_list','schedule')),
  link_id uuid,
  link_label text
);
create index if not exists schedule_items_dates_idx on public.schedule_items (start_date, end_date);
create index if not exists schedule_items_job_idx on public.schedule_items (job_id);
create index if not exists schedule_items_link_idx on public.schedule_items (link_type, link_id) where link_id is not null;
create index if not exists schedule_items_phase_idx on public.schedule_items (phase_id);
create index if not exists schedule_items_schedule_idx on public.schedule_items (schedule_id);

create table if not exists public.schedule_dependencies (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  source_item_id uuid not null references public.schedule_items(id) on delete cascade,
  target_item_id uuid not null references public.schedule_items(id) on delete cascade,
  dependency_type text not null default 'finish_to_start'
    check (dependency_type in ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  lag_days integer not null default 0,
  is_cross_schedule boolean not null default false,
  auto_cascade boolean not null default true,
  is_locked boolean not null default false,
  notes text,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_item_id, target_item_id)
);
create index if not exists schedule_dependencies_job_idx on public.schedule_dependencies (job_id);
create index if not exists schedule_dependencies_source_idx on public.schedule_dependencies (source_item_id);
create index if not exists schedule_dependencies_target_idx on public.schedule_dependencies (target_item_id);

create table if not exists public.schedule_baselines (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.job_schedules(id) on delete cascade,
  name text not null default 'Baseline',
  snapshot jsonb not null default '[]'::jsonb,
  reason text,
  approved_by uuid references public.staff_users(id) on delete set null,
  approved_at timestamptz,
  captured_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists schedule_baselines_schedule_idx on public.schedule_baselines (schedule_id, created_at desc);

create table if not exists public.schedule_participants (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.job_schedules(id) on delete cascade,
  party_type text not null default 'staff',
  staff_id uuid references public.staff_users(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  name text,
  role text,
  can_confirm boolean not null default false,
  confirmation_status text,
  confirmation_at timestamptz,
  created_at timestamptz not null default now(),
  unique (schedule_id, staff_id, contact_id)
);
create index if not exists schedule_participants_schedule_idx on public.schedule_participants (schedule_id);

create table if not exists public.schedule_activity (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  schedule_id uuid references public.job_schedules(id) on delete cascade,
  item_id uuid,
  actor_id uuid references public.staff_users(id) on delete set null,
  actor_name text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists schedule_activity_job_idx on public.schedule_activity (job_id, created_at desc);
create index if not exists schedule_activity_schedule_idx on public.schedule_activity (schedule_id, created_at desc);

create table if not exists public.schedule_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_staff_id uuid not null references public.staff_users(id) on delete cascade,
  kind text not null default 'assigned' check (kind in ('assigned','moved','due','status')),
  title text not null,
  subtitle text,
  job_id uuid references public.jobs(id) on delete cascade,
  schedule_id uuid references public.job_schedules(id) on delete cascade,
  item_id uuid references public.schedule_items(id) on delete cascade,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists schedule_notifications_dedupe_idx on public.schedule_notifications (recipient_staff_id, dedupe_key);
create index if not exists schedule_notifications_recipient_idx on public.schedule_notifications (recipient_staff_id, read_at, created_at desc);

-- Server-only (service role), like the other dashboard tables.
alter table public.job_schedules enable row level security;
alter table public.schedule_phases enable row level security;
alter table public.schedule_items enable row level security;
alter table public.schedule_dependencies enable row level security;
alter table public.schedule_baselines enable row level security;
alter table public.schedule_participants enable row level security;
alter table public.schedule_activity enable row level security;
alter table public.schedule_notifications enable row level security;
