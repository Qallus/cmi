-- ============================================================
-- CMI WebApp — Client Portal Phase 2
-- Selections+approvals (job-scoped), action items, notifications (in-app/email/
-- SMS with per-client channel prefs), engagement reporting inputs.
-- Client access enforced in the API layer; RLS stays permissive-anon.
-- ============================================================

-- ── Selections become job-linkable (reuse the rich project_selections model) ──
ALTER TABLE project_selections ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_project_selections_job ON project_selections(job_id);

-- ── Client action items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_action_items (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id               UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  assigned_contact_id  UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  title                TEXT        NOT NULL,
  description          TEXT,
  due_date             DATE,
  priority             TEXT        DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status               TEXT        DEFAULT 'open'   CHECK (status IN ('open','in_progress','completed','dismissed')),
  related_entity_type  TEXT,
  related_entity_id    UUID,
  created_by           TEXT,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Client notifications (in-app center) ────────────────────
CREATE TABLE IF NOT EXISTS client_notifications (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id    UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  job_id        UUID        REFERENCES jobs(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL DEFAULT 'general',
  title         TEXT        NOT NULL,
  body          TEXT,
  link          TEXT,
  read_at       TIMESTAMPTZ,
  channels_sent TEXT[]      DEFAULT ARRAY['in_app']::text[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Per-client channel preferences ──────────────────────────
CREATE TABLE IF NOT EXISTS client_notification_prefs (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id     UUID        NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  email_enabled  BOOLEAN     DEFAULT TRUE,
  sms_enabled    BOOLEAN     DEFAULT FALSE,   -- opt-in; also consent/suppression gated
  event_prefs    JSONB       DEFAULT '{}'::jsonb,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── updated_at triggers ─────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_action_items','client_notification_prefs'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ── RLS (permissive-anon; app enforces client access) ───────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_action_items','client_notifications','client_notification_prefs'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %s;', t, t);
    EXECUTE format('CREATE POLICY "anon_all_%s" ON %s FOR ALL TO anon USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_action_items_job       ON job_action_items(job_id);
CREATE INDEX IF NOT EXISTS idx_action_items_contact   ON job_action_items(assigned_contact_id);
CREATE INDEX IF NOT EXISTS idx_client_notifs_contact  ON client_notifications(contact_id);
CREATE INDEX IF NOT EXISTS idx_client_notifs_unread   ON client_notifications(contact_id) WHERE read_at IS NULL;
