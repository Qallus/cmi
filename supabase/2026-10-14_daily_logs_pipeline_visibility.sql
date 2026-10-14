-- ============================================================
-- CMI WebApp - Daily Logs: Pipeline deals, visibility, Daily Brief
-- Date: 2026-10-14
--
-- The redesigned Add Daily Log form:
--   - logs can be added to a Pipeline deal (deal_id) as well as a Job or
--     Pre-Con opportunity;
--   - visibility: 'team' (all CMI staff, the default) or 'private' (only
--     the author); client_visible stays as is (Jobs only);
--   - include_in_brief: the author wants this log in their next Daily
--     Brief email ("remind me that this wall needs texturing");
--   - created_by_id: the author's staff id (created_by stays as the email).
--   Title, date, crew, hours, delays, weather and temperature are no longer
--   form fields: the date is set automatically and weather/temperature
--   are looked up for the site. The columns are kept for existing logs.
-- ============================================================

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team';
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS include_in_brief BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES staff_users(id) ON DELETE SET NULL;

ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_has_target;
ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_has_target
  CHECK (job_id IS NOT NULL OR opportunity_id IS NOT NULL OR deal_id IS NOT NULL);
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_visibility_check;
ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_visibility_check CHECK (visibility IN ('team','private'));

CREATE INDEX IF NOT EXISTS daily_logs_deal_idx ON daily_logs (deal_id, log_date DESC) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS daily_logs_brief_idx ON daily_logs (created_by_id, created_at DESC) WHERE include_in_brief;
