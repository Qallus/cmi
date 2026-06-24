-- Recording Studio: meeting recordings, transcripts, and AI meeting intelligence.
create table if not exists public.meetings (
  id                uuid primary key default gen_random_uuid(),
  title             text not null default 'Untitled meeting',
  meeting_type      text not null default 'client_meeting',
  status            text not null default 'draft'
                      check (status in ('draft','processing','transcribed','reviewed','action_items_created','shared_with_client','archived')),
  meeting_date      timestamptz,
  duration_seconds  integer,
  location          text,

  -- Connected records
  contact_id        uuid references public.contacts (id) on delete set null,
  project_item_id   uuid references public.project_schedule_items (id) on delete set null,
  quote_id          uuid references public.quotes (id) on delete set null,
  document_id       text references public.documents (id) on delete set null,
  staff_user_id     uuid references public.staff_users (id) on delete set null,
  related_records   jsonb not null default '[]'::jsonb,
  attendees         jsonb not null default '[]'::jsonb,

  -- Recording (stored in the private meeting-recordings bucket)
  recording_bucket  text,
  recording_path    text,
  recording_filename text,
  recording_mime    text,
  attachments       jsonb not null default '[]'::jsonb,

  -- Intelligence
  transcript        text,
  summary           text,
  action_items      jsonb not null default '[]'::jsonb,
  ai_suggestions    jsonb not null default '[]'::jsonb,
  follow_up_notes   text,
  internal_notes    text,
  client_notes      text,
  client_visible    boolean not null default false,

  created_by        uuid references public.staff_users (id) on delete set null,
  updated_by        uuid references public.staff_users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists meetings_date_idx on public.meetings (meeting_date desc);
create index if not exists meetings_status_idx on public.meetings (status);
create index if not exists meetings_contact_idx on public.meetings (contact_id);
create index if not exists meetings_project_idx on public.meetings (project_item_id);
create index if not exists meetings_created_by_idx on public.meetings (created_by);

alter table public.meetings enable row level security;

-- Private bucket for recordings; all access is brokered by service-role API
-- routes (signed upload + signed playback URLs), so no storage policies needed.
insert into storage.buckets (id, name, public, file_size_limit)
values ('meeting-recordings', 'meeting-recordings', false, 524288000)
on conflict (id) do nothing;
