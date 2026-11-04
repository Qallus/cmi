-- Field Reports (docs/features/field-reports/field-reports-plan.md), behind the
-- field_reports flag (off). Nothing here changes how today's daily logs,
-- Client Updates or Executive Summaries behave until the flag is switched on.

-- ── Step 1: one structured log per job per day ─────────────────────────────
alter table public.daily_logs
  add column if not exists report_version int not null default 1,   -- 2 = field report
  add column if not exists sections jsonb,                          -- { items: [...], raw: [...] }
  add column if not exists status text not null default 'draft',
  add column if not exists log_number int,                          -- per job, field reports only
  add column if not exists submitted_by uuid,
  add column if not exists submitted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'daily_logs_status_check') then
    alter table public.daily_logs add constraint daily_logs_status_check check (status in ('draft', 'submitted'));
  end if;
end $$;

-- Old logs keep their many-per-day rows; field reports are one per job per day.
create unique index if not exists daily_logs_one_report_per_day
  on public.daily_logs (job_id, log_date) where report_version = 2;
create unique index if not exists daily_logs_report_number
  on public.daily_logs (job_id, log_number) where report_version = 2;

-- Action items from a submitted log become internal commitments.
alter table public.commitments drop constraint if exists commitments_source_check;
alter table public.commitments add constraint commitments_source_check
  check (source in ('email', 'sms', 'meeting', 'slack', 'call', 'manual', 'daily_log'));

-- ── Step 3: one Photos library per job ─────────────────────────────────────
create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  url text not null,
  storage text not null default 'cmi-media',
  taken_at timestamptz,
  uploaded_by text,
  uploaded_by_id uuid,
  source_type text not null default 'upload',
  source_id uuid,
  area text,
  trade text,
  tags text[] not null default '{}',
  caption text,
  client_ok boolean not null default false,
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_photos_source_check check (source_type in ('daily_log', 'job_file', 'job_update', 'phone', 'exec_summary', 'upload')),
  constraint job_photos_one_per_url unique (job_id, url)
);
create index if not exists job_photos_job_taken on public.job_photos (job_id, taken_at desc);
alter table public.job_photos enable row level security;   -- service role only, like the other job tables

-- Backfill (no files move): job Files images first, so their client flags win,
-- then Client Update photos, then daily-log photos.
insert into public.job_photos (job_id, url, taken_at, uploaded_by, source_type, source_id, client_ok, caption)
select f.job_id, f.file_url, f.created_at, f.uploaded_by, 'job_file', f.id, coalesce(f.client_visible, false), f.name
from public.job_files f
where f.job_id is not null and f.file_url is not null and f.mime_type like 'image/%'
on conflict (job_id, url) do nothing;

insert into public.job_photos (job_id, url, taken_at, uploaded_by, source_type, source_id, client_ok, caption)
select u.job_id, m->>'url', u.created_at, u.posted_by, 'job_update', u.id, u.visibility = 'client_visible', nullif(m->>'name', '')
from public.job_updates u, jsonb_array_elements(coalesce(u.media, '[]'::jsonb)) m
where u.job_id is not null and m->>'type' = 'image' and coalesce(m->>'url', '') <> ''
on conflict (job_id, url) do nothing;

insert into public.job_photos (job_id, url, taken_at, uploaded_by, source_type, source_id, client_ok)
select u.job_id, u.photo_url, u.created_at, u.posted_by, 'job_update', u.id, u.visibility = 'client_visible'
from public.job_updates u
where u.job_id is not null and coalesce(u.photo_url, '') <> ''
on conflict (job_id, url) do nothing;

insert into public.job_photos (job_id, url, taken_at, uploaded_by, uploaded_by_id, source_type, source_id, client_ok)
select d.job_id, p.url, d.created_at, d.created_by, d.created_by_id, 'daily_log', d.id, coalesce(d.client_visible, false)
from public.daily_logs d, unnest(coalesce(d.photos, '{}')) as p(url)
where d.job_id is not null and coalesce(p.url, '') <> ''
on conflict (job_id, url) do nothing;

-- ── Step 4: Executive Summary periods, sections and library photos ─────────
alter table public.executive_summaries
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists sections jsonb,
  add column if not exists photo_ids uuid[];

-- ── The flag ───────────────────────────────────────────────────────────────
insert into public.feature_flags (key, enabled, description)
values ('field_reports', false, 'Field Reports: one daily log per job per day with sections and Submit, voice sorted into the log, a Photos library per job, and period-based Executive Summaries')
on conflict (key) do nothing;
