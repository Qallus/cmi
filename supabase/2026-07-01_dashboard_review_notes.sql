-- ============================================================
-- CMI WebApp - Dashboard Review Notes (leadership FAB)
-- Date: 2026-07-01
--
-- The bottom-right FAB lets Super Admins capture a note on any dashboard page,
-- attach a screenshot, and share it with other Super Admins (email + in-app
-- bell). Notes are tied to the route they were taken on.
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboard_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route TEXT,
  page_title TEXT,
  note TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'edit'
    CHECK (type IN ('edit','bug','idea','question','remove','other')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','done','archived')),
  created_by TEXT,
  created_by_name TEXT,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  read_by TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  screenshot_url TEXT,
  shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dashboard_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages dashboard notes" ON dashboard_notes;
CREATE POLICY "Service role manages dashboard notes"
  ON dashboard_notes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_dashboard_notes_status ON dashboard_notes(status);
CREATE INDEX IF NOT EXISTS idx_dashboard_notes_created_by ON dashboard_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboard_notes_recipients ON dashboard_notes USING GIN(recipient_emails);
