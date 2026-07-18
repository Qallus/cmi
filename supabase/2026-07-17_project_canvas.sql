-- Project Canvas — Phase 1: schema, DB-backed feature flag, private storage bucket.
--
-- STRICTLY ADDITIVE. Every new table has RLS ENABLED with NO policies, which
-- denies anon/authenticated clients entirely; all access goes through the
-- service role behind route guards (requireClient / requireAdmin), exactly like
-- the rest of the app. Media lives in a PRIVATE bucket (client home photos +
-- voice), mirroring the meeting-recordings pattern (signed URLs, no public read).

-- ─── Generic DB-backed feature flags ───────────────────────────────
create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);
alter table public.feature_flags enable row level security;

insert into public.feature_flags (key, enabled, description)
  values ('project_canvas', false, 'Project Canvas — client photo annotation + brief intake')
  on conflict (key) do nothing;

-- ─── canvas_projects — one canvas (ordered scenes) ─────────────────
-- Owner is a client contact (client-authored) OR a staff user (staff-authored);
-- both nullable. Links to a job and/or a PM project, both nullable so pre-project
-- / prospect canvases are possible (v2 guest flow).
create table if not exists public.canvas_projects (
  id                  uuid primary key default gen_random_uuid(),
  owner_contact_id    uuid references public.contacts(id) on delete set null,
  created_by_staff_id uuid references public.staff_users(id) on delete set null,
  job_id              uuid references public.jobs(id) on delete set null,
  project_id          uuid references public.projects(id) on delete set null,
  title               text not null default 'Untitled canvas',
  status              text not null default 'draft',   -- draft|submitted|in_review|responded
  bolt_summary        jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.canvas_projects enable row level security;
create index if not exists canvas_projects_owner_idx  on public.canvas_projects (owner_contact_id);
create index if not exists canvas_projects_job_idx     on public.canvas_projects (job_id);
create index if not exists canvas_projects_status_idx  on public.canvas_projects (status);

-- ─── canvas_scenes — one media frame + its annotations ─────────────
-- annotations jsonb is the SINGLE SOURCE OF TRUTH for strokes/shapes/pins/stamps.
-- Coordinates inside are 0–1 fractions of the media's natural size.
-- media_path is nullable so a blank scene can be created, then media attached
-- via a signed upload (deviation from spec's NOT NULL — noted in the plan).
create table if not exists public.canvas_scenes (
  id                uuid primary key default gen_random_uuid(),
  canvas_id         uuid not null references public.canvas_projects(id) on delete cascade,
  position          int not null default 0,
  media_path        text,                -- storage path in canvas-media (image or extracted frame)
  source_video_path text,                -- storage path of the source video, if the frame came from one
  annotations       jsonb not null default '{"v":1,"strokes":[],"shapes":[],"pins":[],"stamps":[]}'::jsonb,
  flattened_path    text,                -- generated at submit
  created_at        timestamptz not null default now()
);
alter table public.canvas_scenes enable row level security;
create index if not exists canvas_scenes_canvas_idx on public.canvas_scenes (canvas_id, position);

-- ─── canvas_pins — voice audio + transcripts only ──────────────────
-- Pins also live in the annotations jsonb (source of truth). This table exists
-- ONLY to hold voice audio + its transcript; client_key ties a row back to the
-- pin id inside the jsonb.
create table if not exists public.canvas_pins (
  id                uuid primary key default gen_random_uuid(),
  scene_id          uuid not null references public.canvas_scenes(id) on delete cascade,
  client_key        text,                        -- matches pin.id in annotations jsonb
  kind              text not null default 'voice', -- note|voice
  audio_path        text,
  transcript        text,
  transcript_status text default 'pending',       -- pending|done|failed
  created_at        timestamptz not null default now()
);
alter table public.canvas_pins enable row level security;
create index if not exists canvas_pins_scene_idx on public.canvas_pins (scene_id);

-- ─── Private storage bucket for canvas media (photos, frames, audio) ──
insert into storage.buckets (id, name, public)
  values ('canvas-media', 'canvas-media', false)
  on conflict (id) do nothing;
-- No storage policies: reads/writes go through the service role behind route
-- guards, and objects are handed to clients as short-lived signed URLs.
