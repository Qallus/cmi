-- ============================================================
-- CMI WebApp - Live Page Editor: requester + notification history
-- Date: 2026-07-01
--
-- Lets a review session record who requested the edits, and logs status
-- notifications sent to that person (in-progress / complete / etc.).
-- ============================================================

ALTER TABLE page_review_sessions
  ADD COLUMN IF NOT EXISTS requester_name TEXT,
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS page_review_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_session_id UUID NOT NULL REFERENCES page_review_sessions(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT,
  body TEXT,
  status_snapshot TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  provider TEXT,
  provider_id TEXT,
  error TEXT,
  sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE page_review_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages page review notifications" ON page_review_notifications;
CREATE POLICY "Service role manages page review notifications"
  ON page_review_notifications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_page_review_notifications_session ON page_review_notifications(review_session_id);
