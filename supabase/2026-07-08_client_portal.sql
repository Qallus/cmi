-- ============================================================
-- CMI WebApp — Client Portal (Phase 1)
-- Implements docs/features/client-portal-jobs-feature.md.
-- Extends Jobs with client-facing portal fields, a client updates feed, job
-- messaging, and job-scoped warranty. Client access is enforced in the API
-- layer (requireClient + job-association checks); RLS stays permissive-anon.
-- ============================================================

-- ── Jobs: client-portal fields ──────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_portal_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS progress_percentage    INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_phase          TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_milestone         TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_description      TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cover_image_url         TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_client_update_at   TIMESTAMPTZ;

-- ── Contacts: portal engagement ─────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS portal_last_login_at TIMESTAMPTZ;

-- ── Warranty requests: job scoping + service fields ─────────
ALTER TABLE warranty_requests ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE warranty_requests ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE warranty_requests ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE warranty_requests ADD COLUMN IF NOT EXISTS scheduled_service_date DATE;
ALTER TABLE warranty_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_warranty_requests_job ON warranty_requests(job_id);

-- ── Client updates feed ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_updates (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                 UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title                  TEXT        NOT NULL,
  body                   TEXT,
  update_type            TEXT        DEFAULT 'general',
  visibility             TEXT        NOT NULL DEFAULT 'client_visible'
                         CHECK (visibility IN ('internal', 'client_visible', 'team')),
  posted_by              TEXT,
  client_action_required BOOLEAN     DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job messaging (client ↔ staff, per job) ─────────────────
CREATE TABLE IF NOT EXISTS job_messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id       UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender_type  TEXT        NOT NULL CHECK (sender_type IN ('client', 'staff')),
  sender_id    UUID,
  sender_name  TEXT,
  body         TEXT        NOT NULL,
  category     TEXT        DEFAULT 'general',
  visibility   TEXT        NOT NULL DEFAULT 'client_visible'
               CHECK (visibility IN ('internal', 'client_visible')),
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── updated_at trigger for job_updates ──────────────────────
DROP TRIGGER IF EXISTS trg_job_updates_updated_at ON job_updates;
CREATE TRIGGER trg_job_updates_updated_at
  BEFORE UPDATE ON job_updates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS (permissive-anon; app enforces client access) ───────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_updates', 'job_messages'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %s;', t, t);
    EXECUTE format('CREATE POLICY "anon_all_%s" ON %s FOR ALL TO anon USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_job_updates_job   ON job_updates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_messages_job  ON job_messages(job_id);
