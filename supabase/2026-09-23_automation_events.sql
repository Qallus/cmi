-- The automation log.
--
-- Every scheduled run records what it decided to do, one row per thing. The
-- dedupe key is unique, so a run that fires twice (a retry, an overlapping
-- schedule, a manual trigger) can't send the same notice twice.
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  -- e.g. "coi_expiring_30:<document id>" — stable for the thing + threshold.
  dedupe_key text not null unique,
  subject_type text,
  subject_id uuid,
  channel text,
  recipient text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped', 'failed')),
  skip_reason text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists automation_events_status_idx on public.automation_events (status, created_at);
create index if not exists automation_events_kind_idx on public.automation_events (kind, created_at desc);
alter table public.automation_events enable row level security;

-- Each scheduled run, so a silent cron failure is visible rather than assumed.
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text,
  scanned jsonb not null default '{}'::jsonb,
  sent int not null default 0,
  skipped int not null default 0,
  failed int not null default 0,
  error text
);

create index if not exists automation_runs_started_idx on public.automation_runs (started_at desc);
alter table public.automation_runs enable row level security;
