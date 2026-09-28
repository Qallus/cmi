-- Interviews: the structured meeting that turns a conversation into profile data.
--
-- A template is a list of sections in exactly the shape lib/prequal/form.ts
-- already defines, so the prequalification form engine renders an interview
-- unchanged — same conditional logic, same progress maths, same `mapsTo`
-- pointing an answer at a column on `companies`.
create table if not exists public.interview_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  contact_type text,
  trade text,
  duration_minutes int not null default 45,
  status text not null default 'active' check (status in ('active', 'inactive')),
  -- Section[] — the same JSON the public form is built from.
  sections jsonb not null default '[]'::jsonb,
  default_tags text[] not null default '{}',
  -- Seeded templates are recognised by this; hand-built ones have none and are
  -- never overwritten by a later seed.
  seed_key text unique,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_templates_status_idx on public.interview_templates (status, name);
alter table public.interview_templates enable row level security;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.interview_templates(id) on delete set null,
  -- The questions as they stood when the interview was created. Editing a
  -- template must not rewrite what was actually asked six months ago.
  sections jsonb not null default '[]'::jsonb,

  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  job_id uuid,
  deal_id uuid,
  application_id uuid references public.prequal_applications(id) on delete set null,

  interviewer_id uuid references public.staff_users(id) on delete set null,
  participants uuid[] not null default '{}',

  title text not null,
  interview_type text,
  status text not null default 'draft',

  booking_id uuid,
  scheduled_at timestamptz,
  duration_minutes int not null default 45,
  location text,
  meeting_type text,
  meeting_url text,

  started_at timestamptz,
  completed_at timestamptz,

  answers jsonb not null default '{}'::jsonb,
  progress int not null default 0,

  recording_id uuid,
  transcript text,
  ai_summary text,

  -- Section O of the spec: what the interviewer thought, kept off anything the
  -- partner can ever see.
  internal_notes text,
  strengths text,
  concerns text,
  recommended_next_step text,

  tags text[] not null default '{}',
  archived_at timestamptz,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_status_idx on public.interviews (status, scheduled_at);
create index if not exists interviews_contact_idx on public.interviews (contact_id);
create index if not exists interviews_company_idx on public.interviews (company_id);
create index if not exists interviews_interviewer_idx on public.interviews (interviewer_id);
create index if not exists interviews_scheduled_idx on public.interviews (scheduled_at desc);
alter table public.interviews enable row level security;

-- The interview's own timeline. Module-local, like job_activity_logs and
-- selection_activity; cross-module touches go to `activities` instead.
create table if not exists public.interview_events (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  kind text not null,
  detail text,
  actor_id uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists interview_events_interview_idx on public.interview_events (interview_id, created_at desc);
alter table public.interview_events enable row level security;

-- Documents requested during an interview join the same compliance layer the
-- prequalification application uses, rather than a parallel store.
alter table public.company_documents
  add column if not exists interview_id uuid references public.interviews(id) on delete set null;

create index if not exists company_documents_interview_idx
  on public.company_documents (interview_id) where interview_id is not null;

-- Follow-ups from an interview are ordinary staff tasks, so they belong in the
-- table that already holds those. deal_tasks already has a nullable deal_id
-- and contact_id; this is the third thing a task can hang off.
alter table public.deal_tasks
  add column if not exists interview_id uuid references public.interviews(id) on delete cascade;

create index if not exists deal_tasks_interview_idx
  on public.deal_tasks (interview_id) where interview_id is not null;

-- Interviews are scheduled through the existing booking system. This is the
-- appointment type they use, which brings availability, reminders and calendar
-- sync with it.
insert into public.booking_appointment_types
  (name, slug, description, duration_minutes, location_type, client_visible, is_active, display_order)
select
  'Trade Partner Interview', 'trade-partner-interview',
  'A structured qualification interview with a prospective trade partner.',
  45, 'video_meeting', false, true, 90
where not exists (
  select 1 from public.booking_appointment_types where slug = 'trade-partner-interview'
);
