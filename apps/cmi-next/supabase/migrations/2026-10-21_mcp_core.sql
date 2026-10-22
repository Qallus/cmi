-- CMI MCP server, phase 1: OAuth for Claude connectors, the MCP audit log,
-- the Settings → Claude AI-access grants, and a searchable knowledge base.
--
-- Plan: docs/mcp/CMI-MCP-PLAN.md. Idempotent; safe to re-run.
-- Every table here is server-only: RLS on, no policies, so only the service
-- role (the Next.js server) can read or write.

-- ── OAuth (the app is its own authorization server for /api/mcp) ──────────

create table if not exists public.mcp_oauth_clients (
  client_id     text primary key,
  client_name   text,
  redirect_uris text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- Authorization codes: single use, ~5 minutes, PKCE S256 required.
create table if not exists public.mcp_oauth_codes (
  code_hash      text primary key,
  client_id      text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  staff_user_id  uuid not null references public.staff_users(id) on delete cascade,
  code_challenge text not null,
  redirect_uri   text not null,
  scope          text,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- Access + refresh tokens. Only SHA-256 hashes are stored.
create table if not exists public.mcp_oauth_tokens (
  id             uuid primary key default gen_random_uuid(),
  token_hash     text not null unique,
  refresh_hash   text unique,
  client_id      text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  staff_user_id  uuid not null references public.staff_users(id) on delete cascade,
  scope          text,
  expires_at     timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at     timestamptz,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists mcp_oauth_tokens_staff_idx on public.mcp_oauth_tokens (staff_user_id) where revoked_at is null;

-- ── Audit: one row per MCP tool call ────────────────────────────────────────

create table if not exists public.mcp_audit_log (
  id                uuid primary key default gen_random_uuid(),
  staff_user_id     uuid references public.staff_users(id) on delete set null,
  agent_token_id    uuid,                 -- Paperclip/Hermes agents (later phase)
  client_id         text,
  tool              text not null,
  target_user_email text,
  args              jsonb,                -- redacted / truncated
  success           boolean not null,
  error             text,
  duration_ms       integer,
  created_at        timestamptz not null default now()
);
create index if not exists mcp_audit_log_created_idx on public.mcp_audit_log (created_at desc);
create index if not exists mcp_audit_log_staff_idx on public.mcp_audit_log (staff_user_id, created_at desc);

-- ── Settings → Claude: who may do what with AI ─────────────────────────────
-- One row per person per capability. Capabilities are defined in code
-- (lib/ai-access/capabilities.ts), so adding one needs no migration. A revoked
-- row is kept (revoked_at set) as history; at most one live row per pair.

create table if not exists public.ai_access_grants (
  id            uuid primary key default gen_random_uuid(),
  subject_type  text not null check (subject_type in ('staff', 'contact')),
  staff_user_id uuid references public.staff_users(id) on delete cascade,
  contact_id    uuid references public.contacts(id) on delete cascade,
  capability    text not null,
  enabled       boolean not null default true,  -- false = explicit "off" (overrides a role default)
  note          text,
  granted_by    uuid references public.staff_users(id) on delete set null,
  granted_at    timestamptz not null default now(),
  revoked_by    uuid references public.staff_users(id) on delete set null,
  revoked_at    timestamptz,
  constraint ai_access_grants_one_subject check (
    (subject_type = 'staff'   and staff_user_id is not null and contact_id is null) or
    (subject_type = 'contact' and contact_id is not null and staff_user_id is null)
  )
);
create unique index if not exists ai_access_grants_live_staff_uq
  on public.ai_access_grants (staff_user_id, capability) where revoked_at is null and staff_user_id is not null;
create unique index if not exists ai_access_grants_live_contact_uq
  on public.ai_access_grants (contact_id, capability) where revoked_at is null and contact_id is not null;

-- ── Knowledge base (Bolt training docs → searchable from MCP) ──────────────
-- The table was created by hand in production; this records its shape and
-- adds category / access level / version and full-text search.

create table if not exists public.bolt_training_docs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default '',
  content         text not null default '',
  source_name     text,
  file_path       text,
  enabled         boolean not null default true,
  created_by      uuid,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.bolt_training_docs add column if not exists category text;
alter table public.bolt_training_docs add column if not exists access_level text not null default 'all';
alter table public.bolt_training_docs add column if not exists version integer not null default 1;
do $$ begin
  alter table public.bolt_training_docs add constraint bolt_training_docs_access_level_chk
    check (access_level in ('all', 'financial', 'company'));
exception when duplicate_object then null; end $$;
alter table public.bolt_training_docs add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored;
create index if not exists bolt_training_docs_search_idx on public.bolt_training_docs using gin (search);

-- ── RLS: server-only ────────────────────────────────────────────────────────

alter table public.mcp_oauth_clients  enable row level security;
alter table public.mcp_oauth_codes    enable row level security;
alter table public.mcp_oauth_tokens   enable row level security;
alter table public.mcp_audit_log      enable row level security;
alter table public.ai_access_grants   enable row level security;
alter table public.bolt_training_docs enable row level security;
