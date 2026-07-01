-- ============================================================
-- CMI WebApp - Dashboard note comments (reply thread)
-- Date: 2026-07-01
--
-- Replies / "note back" on a dashboard note, shown in the request detail modal.
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboard_note_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES dashboard_notes(id) ON DELETE CASCADE,
  author_email TEXT,
  author_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dashboard_note_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages dashboard note comments" ON dashboard_note_comments;
CREATE POLICY "Service role manages dashboard note comments"
  ON dashboard_note_comments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_dashboard_note_comments_note ON dashboard_note_comments(note_id);
