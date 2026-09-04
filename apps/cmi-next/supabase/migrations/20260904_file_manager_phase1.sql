-- CMI File Manager — Phase 1 (data model).
-- Garage (S3) holds the bytes; these tables hold the metadata. Access is
-- server-only via the service-role client (getSupabaseAdmin); RLS is
-- deny-by-default (enabled, no policies) — ownership/admin is enforced in the
-- Route Handlers via requireAdmin + role_slug, matching every other CMI module.
--
-- Decisions (approved): uploaded_by/created_by → staff_users(id);
-- forward-looking columns added for the full-stack direction:
--   files.thumbnail_key (client-generated image thumbs), files.metadata jsonb
--   (standard CMI extensibility), files.job_id (Jobs are the app hub).
--
-- Rollback:
--   drop table if exists public.files;
--   drop table if exists public.folders;

create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade,   -- null = company-wide "General"
  job_id      uuid references public.jobs(id) on delete cascade,       -- forward-looking (Jobs hub)
  parent_id   uuid references public.folders(id) on delete cascade,    -- null = root
  name        text not null,
  created_by  uuid references public.staff_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                                              -- soft delete = Trash
);

create index if not exists folders_project_idx on public.folders (project_id);
create index if not exists folders_job_idx     on public.folders (job_id);
create index if not exists folders_parent_idx  on public.folders (parent_id);
create index if not exists folders_active_idx  on public.folders (project_id) where deleted_at is null;

drop trigger if exists set_folders_updated_at on public.folders;
create trigger set_folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,  -- null = "General"
  job_id        uuid references public.jobs(id) on delete cascade,      -- forward-looking (Jobs hub)
  folder_id     uuid references public.folders(id) on delete set null,  -- null = root; folder delete drops file to root
  name          text not null,
  storage_key   text not null unique,                                   -- Garage object key
  thumbnail_key text,                                                   -- optional client-generated thumb (thumbs/…)
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.staff_users(id) on delete set null,
  metadata      jsonb not null default '{}'::jsonb,                     -- extensibility (CMI convention)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz                                             -- soft delete = Trash
);

create index if not exists files_project_idx  on public.files (project_id);
create index if not exists files_job_idx       on public.files (job_id);
create index if not exists files_folder_idx    on public.files (folder_id);
create index if not exists files_uploader_idx  on public.files (uploaded_by);
create index if not exists files_active_idx    on public.files (project_id) where deleted_at is null;

drop trigger if exists set_files_updated_at on public.files;
create trigger set_files_updated_at before update on public.files
  for each row execute function public.set_updated_at();

-- Deny-by-default: RLS on, no policies. Service role (server) bypasses; the
-- anon/authenticated keys can touch nothing. Role/ownership checks live in the API.
alter table public.folders enable row level security;
alter table public.files   enable row level security;

comment on table public.folders is 'File Manager (Garage-backed) folders. Metadata only; RLS deny-by-default, enforced in API.';
comment on table public.files   is 'File Manager (Garage-backed) file metadata. Bytes live in Garage (cmi-app-files); RLS deny-by-default, enforced in API.';
