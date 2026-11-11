-- Selection comments: one thread per selection between the client and the team.
-- Before this, a client's note was text prepended to project_selections.client_comments
-- (and before Nov 9 it overwrote the previous one), only visible inside the editor.
--
-- selection_comments already exists (supabase/2026-05-28_product_selection_phase1.sql:
-- id, selection_id, user_id, comment_type, comment_body, client_visible, created_at,
-- updated_at) but nothing used it. This extends it rather than adding a second table:
-- who wrote it (client or staff), the decision it came with, and whether the team has
-- handled it. Older text in client_comments is imported the first time a selection's
-- thread is read (client_comments_imported_at), then left in place.
-- Access goes through the API with the service role (RLS on, no policies).

alter table public.selection_comments
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists author_kind text not null default 'staff' check (author_kind in ('client', 'staff')),
  add column if not exists author_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists author_name text,
  -- comment | approved | rejected | revision_requested | reply | legacy (imported text)
  add column if not exists action text not null default 'comment',
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references public.staff_users(id) on delete set null;

-- A decision ("Approved") can come with no note.
alter table public.selection_comments alter column comment_body drop not null;

-- Rows written before this by the old plan's comment_type.
update public.selection_comments set author_kind = 'client' where comment_type = 'client' and author_kind = 'staff';

create index if not exists selection_comments_job_open_idx on public.selection_comments (job_id, created_at desc)
  where author_kind = 'client' and handled_at is null;

alter table public.selection_comments enable row level security;

alter table public.project_selections
  add column if not exists client_comments_imported_at timestamptz;

comment on table public.selection_comments is 'Client ↔ team thread on a selection; client rows stay open until a team member marks them handled or replies. client_visible rows show in the client portal.';
comment on column public.project_selections.client_comments_imported_at is 'When the old client_comments text was copied into selection_comments.';
