-- Project Canvas — Phase 5: submission review (team comments + submitted_at).
-- Additive; RLS-locked like the rest of the feature (route-guarded access).

alter table public.canvas_projects add column if not exists submitted_at timestamptz;

create table if not exists public.canvas_comments (
  id              uuid primary key default gen_random_uuid(),
  canvas_id       uuid not null references public.canvas_projects(id) on delete cascade,
  author_staff_id uuid references public.staff_users(id) on delete set null,
  author_name     text,
  body            text not null,
  created_at      timestamptz not null default now()
);
alter table public.canvas_comments enable row level security;
create index if not exists canvas_comments_canvas_idx on public.canvas_comments (canvas_id, created_at);
