-- ============================================================
-- CMI WebApp - Pre-Con + Jobs quick actions
-- Date: 2026-10-14
--
-- Purpose:
--   The checkbox quick-action bar on Pre-Con and Jobs (same as the
--   Pipeline's) sets a "next action" and archives records.
--   - next_action / next_action_due on both tables
--   - archived_at on pipeline_opportunities (jobs already has it);
--     archived opportunities drop out of the Pre-Con list and
--     reporting until restored.
--   Additive and idempotent.
-- ============================================================

ALTER TABLE pipeline_opportunities
  ADD COLUMN IF NOT EXISTS next_action     TEXT,
  ADD COLUMN IF NOT EXISTS next_action_due DATE,
  ADD COLUMN IF NOT EXISTS archived_at     TIMESTAMPTZ;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS next_action     TEXT,
  ADD COLUMN IF NOT EXISTS next_action_due DATE;

CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_archived
  ON pipeline_opportunities (archived_at);
