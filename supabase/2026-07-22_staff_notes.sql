-- Staff Notes (Documents → Notes)
-- ------------------------------------------------------------------
-- Rich personal notes, private to the author and anyone the note is linked to.
-- Linked staff see it in their list and get an in-app + email nudge; linked
-- external emails get an email (best-effort, respecting messaging suppression).
--
-- All access is through server routes using the service-role key, so RLS is
-- enabled with no public policy (matches the rest of the app).

create table if not exists public.staff_notes (
  id                uuid primary key default gen_random_uuid(),
  author_staff_id   uuid references public.staff_users(id) on delete set null,
  author_name       text,
  title             text not null default '',
  body              text not null default '',        -- Markdown
  status            text not null default 'open',     -- open | in_progress | done | archived
  color             text not null default 'default',  -- named color key (see lib/notes/types)
  attachments       jsonb not null default '[]'::jsonb, -- [{id,kind,path,name}]
  linked_staff_ids  uuid[] not null default '{}',
  linked_emails     text[] not null default '{}',
  -- Linked staff ids that have opened the note (drives the "new" nudge), mirrors
  -- dashboard_notes.read_by.
  read_by           uuid[] not null default '{}',
  due_date          date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists staff_notes_author_idx on public.staff_notes (author_staff_id);
create index if not exists staff_notes_linked_idx  on public.staff_notes using gin (linked_staff_ids);
create index if not exists staff_notes_status_idx  on public.staff_notes (status);

alter table public.staff_notes enable row level security;

-- Private storage bucket for note attachments (images/audio/video/files).
insert into storage.buckets (id, name, public)
values ('notes-media', 'notes-media', false)
on conflict (id) do nothing;
