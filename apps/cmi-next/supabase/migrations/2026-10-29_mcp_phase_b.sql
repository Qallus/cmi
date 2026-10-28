-- CMI MCP expansion, Phase B (docs/mcp/CMI-MCP-Expansion-Build-Plan.md):
--   * commitments: the company-wide register of promises and follow-ups
--   * bolt_training_docs.status: knowledge drafts stay out of every AI's
--     search until an admin approves them
--   * meetings.external_source / external_id: a recording saved from Plaud
--     (or anywhere else) is filed once
-- Idempotent. Run BEFORE deploying the Phase B code.

-- ── Commitments register ──────────────────────────────────────────────────
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  owner_staff_id uuid references public.staff_users(id) on delete set null,
  -- Who we're waiting on, if anyone (the commitment is ours to chase).
  waiting_on text not null default 'none' check (waiting_on in ('none', 'client', 'sub', 'teammate', 'vendor')),
  waiting_on_contact_id uuid references public.contacts(id) on delete set null,
  waiting_on_staff_id uuid references public.staff_users(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  opportunity_id uuid references public.pipeline_opportunities(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  -- Where it came from, so it can be traced back and not filed twice.
  source text not null default 'manual' check (source in ('email', 'sms', 'meeting', 'slack', 'call', 'manual')),
  source_link text,
  source_ref text,
  due_on date,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  resolved_by uuid references public.staff_users(id) on delete set null,
  resolved_at timestamptz,
  resolved_evidence text,
  created_by uuid references public.staff_users(id) on delete set null,
  created_via text not null default 'dashboard' check (created_via in ('dashboard', 'mcp', 'bolt')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.commitments enable row level security;
create index if not exists commitments_owner_open on public.commitments(owner_staff_id, due_on) where status = 'open';
create index if not exists commitments_job on public.commitments(job_id) where job_id is not null;
create index if not exists commitments_deal on public.commitments(deal_id) where deal_id is not null;
-- The same source can't produce the same commitment twice.
create unique index if not exists commitments_source_once on public.commitments(source_ref, lower(title)) where source_ref is not null;

-- ── Knowledge base: drafts vs approved ────────────────────────────────────
alter table public.bolt_training_docs add column if not exists status text not null default 'approved';
do $$ begin
  alter table public.bolt_training_docs add constraint bolt_training_docs_status_chk check (status in ('draft', 'approved'));
exception when duplicate_object then null; end $$;
alter table public.bolt_training_docs add column if not exists approved_by uuid references public.staff_users(id) on delete set null;
alter table public.bolt_training_docs add column if not exists approved_at timestamptz;

-- ── Meetings filed from outside (Plaud…) ──────────────────────────────────
alter table public.meetings add column if not exists external_source text;
alter table public.meetings add column if not exists external_id text;
create unique index if not exists meetings_external_once on public.meetings(external_source, external_id) where external_id is not null;

-- ── Commitments page (off until enabled in Settings → Features) ──────────
insert into public.feature_flags (key, enabled, description)
  values ('commitments', false, 'Commitments — company-wide register of promises and follow-ups (dashboard page; Claude can use it either way)')
  on conflict (key) do nothing;
