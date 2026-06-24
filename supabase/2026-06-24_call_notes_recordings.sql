-- Communications: call notes + recording log for the Twilio softphone dialer.
-- Call history, duration, and cost are read live from the Twilio REST API,
-- so we only persist what Twilio cannot give us back per-call: staff notes,
-- and a log of recording-status webhook events.

create table if not exists public.call_notes (
  id          uuid primary key default gen_random_uuid(),
  call_sid    text not null,
  note        text not null,
  author_id   uuid references public.staff_users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists call_notes_call_sid_idx on public.call_notes (call_sid, created_at);

create table if not exists public.call_recordings (
  id                        uuid primary key default gen_random_uuid(),
  call_sid                  text,
  recording_sid             text unique,
  recording_url             text,
  recording_status          text,
  recording_duration_seconds integer,
  created_at                timestamptz not null default now()
);

create index if not exists call_recordings_call_sid_idx on public.call_recordings (call_sid);

-- RLS: staff-only access. Service-role (used by API routes) bypasses RLS.
alter table public.call_notes enable row level security;
alter table public.call_recordings enable row level security;
