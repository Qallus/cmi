-- Pins: also show a project in another area (one home per project, Step 2).
-- A project lives in one of Pipeline → Pre-Con → Jobs (lib/handoff/home.ts).
-- A pin shows it on another board too, as a "pinned here" card that opens the
-- real record and is left out of that board's counts, totals and reports.
--   record_type / record_id  the project's home record: a deal, a Pre-Con
--                            record (pipeline_opportunities) or a job
--   show_in                  the extra board: pipeline | precon | jobs
--   expires_at               reserved for an expiry option later (null = never)
-- Any CMI staff member can pin. RLS on with no policies: the app's server
-- (service role) reads and writes.

create table if not exists public.project_pins (
  id           uuid primary key default gen_random_uuid(),
  record_type  text not null check (record_type in ('deal', 'precon', 'job')),
  record_id    uuid not null,
  show_in      text not null check (show_in in ('pipeline', 'precon', 'jobs')),
  note         text check (note is null or char_length(note) <= 200),
  pinned_by    uuid references public.staff_users(id) on delete set null,
  pinned_at    timestamptz not null default now(),
  expires_at   timestamptz
);

create unique index if not exists project_pins_record_area_uq on public.project_pins (record_type, record_id, show_in);
create index if not exists project_pins_show_in_idx on public.project_pins (show_in);
create index if not exists project_pins_pinned_by_idx on public.project_pins (pinned_by);

alter table public.project_pins enable row level security;

comment on table public.project_pins is 'Show a project on another board too (Pipeline / Pre-Con / Jobs); the record stays in its one home.';
comment on column public.project_pins.expires_at is 'Reserved for an expiry option; null = the pin stays until someone unpins it.';
