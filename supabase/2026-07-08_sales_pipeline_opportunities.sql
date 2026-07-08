-- ============================================================
-- CMI WebApp — Sales Pipeline / Opportunity Lifecycle
-- Implements docs/features/cmi-sales-process-leads-opportunities.md
--
-- Terminology (see docs):
--   Lead        = existing `contacts` (type='Lead') + `quotes` intake.
--                 Leads live in the CRM and DO NOT get a job number.
--   Opportunity = a realistic potential project. A row is created here in
--                 `pipeline_opportunities` and a JOB NUMBER is assigned by the
--                 insert trigger — i.e. the job number is created the moment a
--                 Lead becomes an Opportunity, never before.
--
-- Lifecycle stages carried by the single `stage` column:
--   opportunity → active_budget → pre_construction_design → active_project
--               → warranty → closed
--   Alternate paths from the budget phases: long_lead, not_moving_forward.
-- ============================================================

-- ── Central lifecycle table (Opportunity → Closed + alt paths) ──
CREATE TABLE IF NOT EXISTS pipeline_opportunities (
  id                        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_number                TEXT        UNIQUE,   -- assigned by trigger on insert
  stage                     TEXT        NOT NULL DEFAULT 'opportunity'
                            CHECK (stage IN (
                              'opportunity','active_budget','pre_construction_design',
                              'active_project','warranty','closed',
                              'long_lead','not_moving_forward')),
  -- Human-readable reason attached to the current stage (lost reason, long-lead
  -- reason, etc.). The typed *_reason columns below hold the normalized value.
  status_reason             TEXT,

  -- ── Links back into the CRM / rest of the app ──
  contact_id                UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  linked_quote_id           UUID        REFERENCES quotes(id)   ON DELETE SET NULL,
  linked_lead_id            UUID,       -- optional business_card_leads / external id
  project_item_id           UUID,       -- optional link to project_schedule_items project

  -- ── Opportunity core ──
  opportunity_name          TEXT        NOT NULL,
  project_address           TEXT,
  city                      TEXT,
  state                     TEXT        DEFAULT 'AZ',
  zip_code                  TEXT,
  project_type              TEXT,       -- remodel/addition/adu/casita/custom_home/...
  estimated_budget_range    TEXT,
  estimated_project_value   NUMERIC(14,2),
  probability_percent       INTEGER,
  source                    TEXT,
  referral_source           TEXT,
  assigned_owner            TEXT,       -- display name (kept for quick reads)
  assigned_owner_id         UUID,       -- staff_users.id when known
  tags                      TEXT[],
  notes                     TEXT,

  -- ── Active Budget phase ──
  budget_status             TEXT,       -- initial_review/estimating/budget_sent/...
  budget_owner              TEXT,
  budget_due_date           DATE,
  last_budget_sent_date     DATE,
  budget_revision_count     INTEGER     DEFAULT 0,
  current_budget_total      NUMERIC(14,2),
  internal_estimated_cost   NUMERIC(14,2),
  projected_margin          NUMERIC(6,2),

  -- ── Pre-Construction / Design phase ──
  agreement_status          TEXT,       -- pending/signed/verbal_commitment/design_only/...
  design_team               TEXT[],
  architect                 TEXT,
  designer                  TEXT,
  engineer                  TEXT,
  permit_status             TEXT,       -- not_started/in_progress/submitted/approved/...
  procurement_status        TEXT,       -- not_started/planning/pricing/selections_needed/ready
  projected_construction_start_date DATE,
  projected_construction_value      NUMERIC(14,2),
  forecast_probability_percent      INTEGER,

  -- ── Active Project phase ──
  construction_agreement_status TEXT,   -- signed/committed/pending_final_signature
  start_date                DATE,
  projected_completion_date DATE,
  actual_completion_date    DATE,
  project_manager           TEXT,
  superintendent            TEXT,
  project_status            TEXT,        -- scheduled/active/delayed/punch_list/complete/...
  contract_value            NUMERIC(14,2),
  approved_change_orders_total NUMERIC(14,2) DEFAULT 0,
  current_project_value     NUMERIC(14,2),

  -- ── Warranty phase ──
  warranty_start_date       DATE,
  warranty_expiration_date  DATE,
  warranty_period_months    INTEGER     DEFAULT 24,
  warranty_status           TEXT,        -- active/request_received/in_progress/resolved/expired

  -- ── Closed phase ──
  closed_date               DATE,
  final_contract_value      NUMERIC(14,2),
  final_project_value       NUMERIC(14,2),
  final_margin              NUMERIC(6,2),
  closeout_notes            TEXT,

  -- ── Long Lead (alternate path) ──
  long_lead_reason          TEXT,        -- waiting_on_financing/waiting_on_design/...
  follow_up_date            DATE,
  follow_up_owner           TEXT,
  follow_up_frequency       TEXT,        -- weekly/monthly/quarterly/custom

  -- ── Not Moving Forward (alternate path) ──
  lost_reason               TEXT,        -- not_feasible/outside_budget/chose_another_builder/...
  lost_to_builder           TEXT,
  lost_date                 DATE,

  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job number generation ──────────────────────────────────
-- A sequence-backed trigger assigns a job number the instant a row (an
-- Opportunity) is inserted, so numbers are unique and race-free. Format:
--   CM-YYYY-####   e.g. CM-2026-0007
-- A caller may still pass an explicit job_number (manual override) — the
-- trigger only fills it in when NULL.
CREATE SEQUENCE IF NOT EXISTS pipeline_job_number_seq START 1;

CREATE OR REPLACE FUNCTION assign_pipeline_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    NEW.job_number := 'CM-' || to_char(NOW(), 'YYYY') || '-' ||
                      lpad(nextval('pipeline_job_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pipeline_job_number ON pipeline_opportunities;
CREATE TRIGGER trg_pipeline_job_number
  BEFORE INSERT ON pipeline_opportunities
  FOR EACH ROW EXECUTE FUNCTION assign_pipeline_job_number();

-- ── Stage transition history (powers conversion + time-in-stage reporting) ──
CREATE TABLE IF NOT EXISTS pipeline_stage_history (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id  UUID        NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  job_number      TEXT,
  from_stage      TEXT,
  to_stage        TEXT        NOT NULL,
  changed_by      TEXT,       -- staff display name / email
  changed_by_id   UUID,       -- staff_users.id
  note            TEXT,
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Warranty requests (client portal / website tie-back) ──
CREATE TABLE IF NOT EXISTS warranty_requests (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id    UUID        REFERENCES pipeline_opportunities(id) ON DELETE SET NULL,
  job_number        TEXT,
  contact_id        UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  submitted_by      TEXT,
  submitter_email   TEXT,
  submitter_phone   TEXT,
  request_title     TEXT        NOT NULL,
  request_description TEXT,
  location_in_home  TEXT,
  priority          TEXT        DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','urgent')),
  status            TEXT        DEFAULT 'submitted'
                    CHECK (status IN ('submitted','under_review','scheduled','in_progress','resolved','closed')),
  assigned_to       TEXT,
  photos            TEXT[],
  documents         TEXT[],
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── updated_at maintenance (reuse existing helper) ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_opportunities','warranty_requests'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ── Row Level Security (matches existing permissive-anon convention; the
--    Next.js app reaches these tables through the service-role client and
--    enforces role gating in the API layer) ──
ALTER TABLE pipeline_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_requests      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_pipeline_opportunities" ON pipeline_opportunities;
DROP POLICY IF EXISTS "anon_all_pipeline_stage_history" ON pipeline_stage_history;
DROP POLICY IF EXISTS "anon_all_warranty_requests"      ON warranty_requests;
CREATE POLICY "anon_all_pipeline_opportunities" ON pipeline_opportunities FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_pipeline_stage_history" ON pipeline_stage_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_warranty_requests"      ON warranty_requests      FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_pipeline_stage        ON pipeline_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_job_number   ON pipeline_opportunities(job_number);
CREATE INDEX IF NOT EXISTS idx_pipeline_contact      ON pipeline_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_owner        ON pipeline_opportunities(assigned_owner_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_follow_up    ON pipeline_opportunities(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_stage_history_opp     ON pipeline_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_warranty_opp          ON warranty_requests(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_warranty_status       ON warranty_requests(status);
