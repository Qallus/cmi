-- ============================================================
-- CMI WebApp — Job Modules: Change Orders, Invoices, Daily Logs, Files
-- Extends the Jobs feature (docs/features/job-features.md). All records are
-- job-scoped (job_id → jobs) and cascade-delete with the job.
-- ============================================================

-- ── Change Orders ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_orders (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id         UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  co_number      TEXT,       -- per-job CO-#### (assigned in the data layer)
  title          TEXT        NOT NULL,
  description    TEXT,
  status         TEXT        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','submitted','pending_approval','approved','rejected','void')),
  amount         NUMERIC(14,2) DEFAULT 0,
  co_date        DATE,
  approved_date  DATE,
  requested_by   TEXT,
  client_visible BOOLEAN     DEFAULT FALSE,
  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Invoices ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id         UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  invoice_number TEXT,       -- per-job INV-#### (assigned in the data layer)
  title          TEXT,
  status         TEXT        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','partial','paid','overdue','void')),
  issue_date     DATE,
  due_date       DATE,
  amount         NUMERIC(14,2) DEFAULT 0,       -- rolled up from line items
  amount_paid    NUMERIC(14,2) DEFAULT 0,
  notes          TEXT,
  sent_at        TIMESTAMPTZ,
  client_visible BOOLEAN     DEFAULT FALSE,
  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id   UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  TEXT        NOT NULL DEFAULT '',
  quantity     NUMERIC(12,2) DEFAULT 1,
  unit_price   NUMERIC(14,2) DEFAULT 0,
  amount       NUMERIC(14,2) DEFAULT 0,
  sort_order   INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Daily Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_logs (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id         UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  log_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  title          TEXT,
  notes          TEXT,
  weather        TEXT,
  temperature    TEXT,
  hours_worked   NUMERIC(8,2),
  crew           TEXT[],
  visitors       TEXT,
  delays         TEXT,
  photos         TEXT[],
  client_visible BOOLEAN     DEFAULT FALSE,
  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job Files ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_files (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id         UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  folder         TEXT        DEFAULT 'General',
  name           TEXT        NOT NULL,
  file_url       TEXT        NOT NULL,
  mime_type      TEXT,
  size_bytes     BIGINT,
  category       TEXT,
  client_visible BOOLEAN     DEFAULT FALSE,
  uploaded_by    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── updated_at triggers ─────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['change_orders','invoices','daily_logs','job_files'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ── RLS (permissive-anon; app uses the service-role client) ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['change_orders','invoices','invoice_line_items','daily_logs','job_files'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %s;', t, t);
    EXECUTE format('CREATE POLICY "anon_all_%s" ON %s FOR ALL TO anon USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_change_orders_job    ON change_orders(job_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);
CREATE INDEX IF NOT EXISTS idx_invoices_job         ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv    ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_job       ON daily_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_files_job        ON job_files(job_id);
