-- Website pages Claude can create and publish (CMI MCP Phase F).
-- A page is a landing page at /lp/<slug>, built from the same template as
-- /lp/design-build-enjoy (components/site/micro-landing.tsx). Each page has a
-- draft (what's being edited) and a published copy (what's live); every
-- publish saves a version so it can be rolled back. Super Admin only.
-- Idempotent; server-only (RLS on, no policies).
create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- { title, description, landing: MicroLandingContent }
  draft jsonb not null,
  published jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  published_at timestamptz,
  published_by uuid references public.staff_users(id) on delete set null,
  -- Secret for /lp/<slug>?preview=<token>: shows the draft, never indexed.
  preview_token text not null default encode(gen_random_bytes(18), 'hex'),
  created_by uuid references public.staff_users(id) on delete set null,
  updated_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.site_pages enable row level security;
-- One live page per address; a deleted page frees its slug.
create unique index if not exists site_pages_slug_live on public.site_pages(slug) where deleted_at is null;

create table if not exists public.site_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  content jsonb not null,
  note text,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.site_page_versions enable row level security;
create index if not exists site_page_versions_page on public.site_page_versions(page_id, created_at desc);
