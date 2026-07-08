-- ============================================================
-- CMI WebApp — Jobs Feature (Buildertrend-inspired)
-- Implements docs/features/job-features.md
--
-- A Job is the central PROJECT record, created when an Opportunity becomes a
-- real project. It links back to the sales pipeline:
--   Lead (contacts/quotes) → Opportunity (pipeline_opportunities, CM-YYYY-####)
--                          → JOB (jobs, YY_###_JobName)
-- Leads/Opportunities are NOT replaced — the Job sits downstream of them.
-- ============================================================

-- ── Configurable job types (admin-managed) ──────────────────
CREATE TABLE IF NOT EXISTS job_types (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL UNIQUE,
  description  TEXT,
  color        TEXT,
  sort_order   INTEGER     DEFAULT 0,
  is_active    BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job groups (reporting / template grouping) ──────────────
CREATE TABLE IF NOT EXISTS job_groups (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL UNIQUE,
  description  TEXT,
  sort_order   INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Per-year job-number counter (powers YY_###_ sequence) ────
CREATE TABLE IF NOT EXISTS job_number_counters (
  year      INTEGER PRIMARY KEY,
  last_seq  INTEGER NOT NULL DEFAULT 0
);

-- ── Jobs (central project record) ───────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Links back into the sales pipeline / CRM
  related_lead_id           UUID,       -- source contact/quote id
  related_opportunity_id    UUID        REFERENCES pipeline_opportunities(id) ON DELETE SET NULL,

  -- Identity
  job_number                TEXT        UNIQUE,        -- YY_###_JobName (trigger-assigned)
  job_name                  TEXT        NOT NULL UNIQUE,
  prefix                    TEXT,
  job_type_id               UUID        REFERENCES job_types(id) ON DELETE SET NULL,
  job_group_id              UUID        REFERENCES job_groups(id) ON DELETE SET NULL,
  status                    TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN (
                              'draft','opportunity','active_budget','pre_construction_design',
                              'active_project','warranty','closed',
                              'long_lead','not_moving_forward','on_hold','cancelled')),
  job_color                 TEXT,

  -- Contract / pricing
  contract_type             TEXT        CHECK (contract_type IN ('fixed_price','open_book') OR contract_type IS NULL),
  contract_price            NUMERIC(14,2),

  -- Address
  street_address            TEXT,
  city                      TEXT,
  state                     TEXT        DEFAULT 'AZ',
  zip_code                  TEXT,
  full_address              TEXT,
  latitude                  DOUBLE PRECISION,
  longitude                 DOUBLE PRECISION,

  -- Schedule
  projected_start_date      DATE,
  actual_start_date         DATE,
  projected_completion_date DATE,
  actual_completion_date    DATE,
  update_actual_dates_from_schedule BOOLEAN DEFAULT FALSE,
  schedule_color            TEXT,
  work_days                 TEXT[],

  -- Additional detail
  funded_by_construction_loan BOOLEAN   DEFAULT FALSE,
  square_feet               INTEGER,
  permit_number             TEXT,
  lot_info                  TEXT,
  internal_notes            TEXT,
  vendor_notes              TEXT,

  -- Templates / accounting
  is_template               BOOLEAN     DEFAULT FALSE,
  source_template_id        UUID        REFERENCES jobs(id) ON DELETE SET NULL,
  accounting_customer_id    TEXT,

  created_by                TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  archived_at               TIMESTAMPTZ
);

-- ── Job number generation ───────────────────────────────────
-- Assigns YY_###_JobName on insert when job_number is blank. The ### sequence
-- resets each calendar year via job_number_counters (matching 24_031 → 25_000).
-- Templates are skipped (they are not real jobs). Explicit job_number is honored
-- so staff with permission can override.
CREATE OR REPLACE FUNCTION assign_job_number()
RETURNS TRIGGER AS $$
DECLARE
  yr    INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  yy    TEXT    := to_char(NOW(), 'YY');
  seq   INTEGER;
BEGIN
  IF NEW.is_template THEN
    RETURN NEW;  -- templates don't consume job numbers
  END IF;
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    INSERT INTO job_number_counters (year, last_seq)
      VALUES (yr, 1)
      ON CONFLICT (year) DO UPDATE SET last_seq = job_number_counters.last_seq + 1
      RETURNING last_seq INTO seq;
    NEW.job_number := yy || '_' || lpad(seq::text, 3, '0') || '_' || NEW.job_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_job_number ON jobs;
CREATE TRIGGER trg_jobs_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION assign_job_number();

-- ── Job ↔ client contacts (portal + permissions) ────────────
CREATE TABLE IF NOT EXISTS job_contacts (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                 UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id             UUID        REFERENCES contacts(id) ON DELETE CASCADE,
  role                   TEXT        DEFAULT 'client',
  is_primary             BOOLEAN     DEFAULT FALSE,
  portal_access_enabled  BOOLEAN     DEFAULT FALSE,
  permissions            JSONB       DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, contact_id)
);

-- ── Job ↔ internal staff users ──────────────────────────────
CREATE TABLE IF NOT EXISTS job_internal_users (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                 UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  staff_user_id          UUID        REFERENCES staff_users(id) ON DELETE CASCADE,
  role                   TEXT,
  access_statuses        TEXT[]      DEFAULT ARRAY['open']::text[],
  notifications_enabled  BOOLEAN     DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, staff_user_id)
);

-- ── Job ↔ subs / vendors (contacts of type Vendor/Sub) ──────
CREATE TABLE IF NOT EXISTS job_vendors (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                 UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  vendor_contact_id      UUID        REFERENCES contacts(id) ON DELETE CASCADE,
  role                   TEXT,
  access_permissions     JSONB       DEFAULT '{}'::jsonb,
  notifications_enabled  BOOLEAN     DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, vendor_contact_id)
);

-- ── Advanced settings (one row per job) ─────────────────────
CREATE TABLE IF NOT EXISTS job_settings (
  id                                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                            UUID        NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  geofencing_enabled                BOOLEAN     DEFAULT FALSE,
  allow_allowances                  BOOLEAN     DEFAULT TRUE,
  schedule_online                   BOOLEAN     DEFAULT FALSE,
  client_updates_enabled            BOOLEAN     DEFAULT TRUE,
  daily_logs_enabled                BOOLEAN     DEFAULT TRUE,
  warranty_claims_enabled           BOOLEAN     DEFAULT TRUE,
  markup_type                       TEXT        DEFAULT 'markup',
  markup_percentage                 NUMERIC(6,2),
  default_tax_rate                  NUMERIC(6,3),
  projection_reference_default      TEXT,
  include_time_clock_labor_in_budget BOOLEAN    DEFAULT FALSE,
  individual_po_limit               NUMERIC(14,2),
  total_po_limit                    NUMERIC(14,2),
  updated_at                        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Insurance / risk (one row per job) ──────────────────────
CREATE TABLE IF NOT EXISTS job_insurance (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id             UUID        NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  status             TEXT        DEFAULT 'not_started',
  provider           TEXT,
  policy_number      TEXT,
  policy_start_date  DATE,
  policy_end_date    DATE,
  coverage_amount    NUMERIC(14,2),
  certificate_url    TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job activity / audit log ────────────────────────────────
CREATE TABLE IF NOT EXISTS job_activity_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id      UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  actor       TEXT,
  actor_id    UUID,
  action      TEXT        NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── updated_at maintenance ──────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_types','job_groups','jobs','job_settings','job_insurance'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ── Row Level Security (permissive-anon; app uses service role) ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'job_types','job_groups','jobs','job_contacts','job_internal_users',
    'job_vendors','job_settings','job_insurance','job_activity_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %s;', t, t);
    EXECUTE format('CREATE POLICY "anon_all_%s" ON %s FOR ALL TO anon USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type           ON jobs(job_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_group          ON jobs(job_group_id);
CREATE INDEX IF NOT EXISTS idx_jobs_opportunity    ON jobs(related_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_template    ON jobs(is_template);
CREATE INDEX IF NOT EXISTS idx_jobs_archived       ON jobs(archived_at);
CREATE INDEX IF NOT EXISTS idx_job_contacts_job    ON job_contacts(job_id);
CREATE INDEX IF NOT EXISTS idx_job_users_job       ON job_internal_users(job_id);
CREATE INDEX IF NOT EXISTS idx_job_vendors_job     ON job_vendors(job_id);
CREATE INDEX IF NOT EXISTS idx_job_activity_job    ON job_activity_logs(job_id);

-- ── Seed initial job types (idempotent) ─────────────────────
INSERT INTO job_types (name, sort_order) VALUES
  ('Residential', 1), ('Commercial', 2), ('Whole Home Remodel', 3),
  ('Kitchen Remodel', 4), ('Bathroom Remodel', 5), ('ADU / Casita', 6),
  ('Addition', 7), ('New Build', 8), ('Tenant Improvement', 9),
  ('Warranty', 10), ('Service Work', 11), ('Internal / Admin', 12),
  ('Template', 13), ('Other', 14)
ON CONFLICT (name) DO NOTHING;
