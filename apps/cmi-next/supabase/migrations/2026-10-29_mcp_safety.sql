-- CMI MCP expansion, Phase A: the safety layer that has to exist before any
-- AI write tool ships (docs/mcp/CMI-MCP-Expansion-Build-Plan.md).
--   * mcp_pending_actions: high-risk calls wait here for cmi_confirm
--   * mcp_clients: which AI clients may connect, and at which risk tiers
--   * record_trash: AI "delete" = restorable trash, never a hard delete
--   * mcp_settings: per-person daily caps
--   * mcp_audit_log: risk, client, record and before/after
-- Idempotent. Run BEFORE deploying the Phase A code. Server-only tables
-- (RLS on, no policies), like the other mcp_* tables.

-- ── AI clients ────────────────────────────────────────────────────────────
create table if not exists public.mcp_clients (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('claude', 'chatgpt', 'codex', 'paperclip', 'other')),
  name text not null,
  redirect_uris text[] not null default '{}',
  allowed_tiers text[] not null default '{read,write,high}',
  enabled boolean not null default true,
  created_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mcp_clients enable row level security;
create unique index if not exists mcp_clients_kind_name on public.mcp_clients(kind, name);

insert into public.mcp_clients (kind, name, redirect_uris, allowed_tiers)
values ('claude', 'Claude (Team)', array['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'], '{read,write,high}')
on conflict (kind, name) do nothing;

-- Which kind of client registered (set at dynamic registration from the redirect URI).
alter table public.mcp_oauth_clients add column if not exists client_kind text;
update public.mcp_oauth_clients set client_kind = 'claude'
where client_kind is null and redirect_uris && array['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];

-- ── Pending high-risk actions ─────────────────────────────────────────────
create table if not exists public.mcp_pending_actions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.staff_users(id) on delete cascade,
  token_id uuid,
  client_id text,
  client_kind text,
  tool text not null,
  args jsonb not null default '{}',
  preview jsonb not null default '{}',
  risk text not null default 'high',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'expired', 'failed')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  confirmed_at timestamptz,
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);
alter table public.mcp_pending_actions enable row level security;
create index if not exists mcp_pending_actions_staff on public.mcp_pending_actions(staff_user_id, status, created_at desc);

-- ── Trash (restorable deletes) ────────────────────────────────────────────
create table if not exists public.record_trash (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  record_id text not null,
  label text,
  method text not null check (method in ('archive', 'status', 'snapshot')),
  snapshot jsonb not null default '{}',
  deleted_by uuid references public.staff_users(id) on delete set null,
  deleted_via text not null default 'mcp' check (deleted_via in ('mcp', 'bolt', 'dashboard')),
  deleted_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid references public.staff_users(id) on delete set null
);
alter table public.record_trash enable row level security;
create index if not exists record_trash_open on public.record_trash(deleted_at desc) where restored_at is null;
create index if not exists record_trash_record on public.record_trash(entity, record_id);

-- ── Daily caps ────────────────────────────────────────────────────────────
create table if not exists public.mcp_settings (
  id boolean primary key default true check (id),
  caps jsonb not null default '{"email": 25, "sms": 25, "trash": 20}',
  updated_by uuid references public.staff_users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.mcp_settings enable row level security;
insert into public.mcp_settings (id) values (true) on conflict (id) do nothing;

-- ── Audit: risk, client, record, before/after ─────────────────────────────
alter table public.mcp_audit_log add column if not exists risk text;
alter table public.mcp_audit_log add column if not exists client_kind text;
alter table public.mcp_audit_log add column if not exists entity text;
alter table public.mcp_audit_log add column if not exists record_id text;
alter table public.mcp_audit_log add column if not exists before jsonb;
alter table public.mcp_audit_log add column if not exists after jsonb;
alter table public.mcp_audit_log add column if not exists confirmation_id uuid;
alter table public.mcp_audit_log add column if not exists cap_group text;
create index if not exists mcp_audit_log_caps on public.mcp_audit_log(staff_user_id, cap_group, created_at desc) where cap_group is not null;
