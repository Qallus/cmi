-- Trade Partner Portal, Phase 3: AI reading of COIs / W-9s / licenses,
-- reminder tracking, and requalification. Idempotent. Run BEFORE deploying
-- the Phase 3 code.

-- ── What Claude read off each compliance document ──────────────────────────
-- coverages: one entry per coverage line on a COI (line, carrier, policy,
-- effective/expiration, limits, meets_minimum). Never stores a TIN/SSN.
alter table public.company_documents add column if not exists coverages      jsonb;
alter table public.company_documents add column if not exists ai_status      text;   -- pending | parsed | failed | skipped
alter table public.company_documents add column if not exists ai_summary     text;
alter table public.company_documents add column if not exists ai_flags       text[] not null default '{}';
alter table public.company_documents add column if not exists ai_parsed_at   timestamptz;
alter table public.company_documents add column if not exists ai_model       text;
alter table public.company_documents add column if not exists ai_error       text;
do $$ begin
  alter table public.company_documents add constraint company_documents_ai_status_chk
    check (ai_status is null or ai_status in ('pending', 'parsed', 'failed', 'skipped'));
exception when duplicate_object then null; end $$;

-- ── Requalification ────────────────────────────────────────────────────────
alter table public.companies add column if not exists last_requalified_at  timestamptz;
alter table public.companies add column if not exists requal_requested_at  timestamptz;
-- Partners we no longer use: left out of "select all" requalification sends.
alter table public.companies add column if not exists requal_excluded      boolean not null default false;

-- A requalification is an application row with source = 'requalification';
-- the office's message and whether the current MSA must be (re)signed ride along.
alter table public.prequal_applications add column if not exists requal_message     text;
alter table public.prequal_applications add column if not exists requal_include_msa boolean not null default false;
alter table public.prequal_applications add column if not exists requested_by       uuid references public.staff_users(id) on delete set null;
