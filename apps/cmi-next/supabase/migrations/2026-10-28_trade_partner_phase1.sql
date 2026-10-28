-- Trade Partner Portal, Phase 1 (docs/trade-partners/CMI_Trade_Partner_Portal_Build_Plan.md).
-- Contact-page routing, form changes, in-app MSA e-signature, cost codes.
-- Idempotent; server-only RLS on every new table. Run BEFORE deploying the
-- Phase 1 code: submit writes the new companies columns.

-- ── Contact page: which path a submission came in on ───────────────────────
alter table public.contact_submissions add column if not exists kind text not null default 'client';
do $$ begin
  alter table public.contact_submissions add constraint contact_submissions_kind_chk
    check (kind in ('client', 'vendor_pitch', 'trade_partner', 'spam'));
exception when duplicate_object then null; end $$;
alter table public.contact_submissions add column if not exists spam_reason text;

-- ── Contacts by role at a company (feeds bid packages) ─────────────────────
-- primary | accounting | estimating | field | emergency
alter table public.contacts add column if not exists company_roles text[] not null default '{}';

-- ── New application answers that land on the company ──────────────────────
alter table public.companies add column if not exists partner_type_other text;
alter table public.companies add column if not exists business_structure_other text;
alter table public.companies add column if not exists trades_other text;
alter table public.companies add column if not exists years_in_business_range text;
alter table public.companies add column if not exists employee_count_range text;
alter table public.companies add column if not exists concurrent_capacity_range text;
alter table public.companies add column if not exists currently_available boolean;
alter table public.companies add column if not exists available_from date;
alter table public.companies add column if not exists capacity_notes text;
alter table public.companies add column if not exists estimates_without_plans boolean;
alter table public.companies add column if not exists payment_terms text;
alter table public.companies add column if not exists portfolio_url text;
alter table public.companies add column if not exists meets_gl_minimum boolean;
alter table public.companies add column if not exists meets_auto_minimum boolean;
alter table public.companies add column if not exists meets_wc_minimum boolean;
alter table public.companies add column if not exists meets_umbrella_minimum boolean;
alter table public.companies add column if not exists can_name_additional_insured boolean;

-- ── Trades → CMI cost codes (never shown to the sub; on reports/exports) ──
create table if not exists public.trade_cost_codes (
  trade      text primary key,
  cost_code  text,
  label      text,
  active     boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ── Master Subcontractor Agreement versions and signatures ────────────────
create table if not exists public.msa_versions (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,                    -- e.g. "Rev 2026"
  storage_path text not null,                    -- prequal-documents bucket
  file_name    text,
  sha256       text not null,                    -- fingerprint of the exact PDF signed
  effective_at date,
  is_current   boolean not null default false,
  uploaded_by  uuid references public.staff_users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists msa_versions_one_current on public.msa_versions (is_current) where is_current;

create table if not exists public.msa_signatures (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid references public.prequal_applications(id) on delete set null,
  company_id        uuid references public.companies(id) on delete set null,
  msa_version_id    uuid not null references public.msa_versions(id) on delete restrict,
  signer_name       text not null,
  signer_title      text,
  signer_email      text not null,
  -- Email one-time code: hash + expiry while pending, verified_at once entered.
  code_hash         text,
  code_expires_at   timestamptz,
  code_attempts     integer not null default 0,
  email_verified_at timestamptz,
  consent_text      text,
  consented_at      timestamptz,
  signature_path    text,                         -- drawn signature PNG
  doc_sha256        text,                         -- = msa_versions.sha256 at signing
  ip                text,
  user_agent        text,
  signed_at         timestamptz,
  signed_pdf_path   text,
  countersigned_by  uuid references public.staff_users(id) on delete set null,
  countersigner_name text,
  countersigned_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists msa_signatures_application_idx on public.msa_signatures (application_id);
create index if not exists msa_signatures_company_idx on public.msa_signatures (company_id);

alter table public.trade_cost_codes enable row level security;
alter table public.msa_versions     enable row level security;
alter table public.msa_signatures   enable row level security;

-- Duplicate finder uses similarity(); already installed in production.
create extension if not exists pg_trgm;
