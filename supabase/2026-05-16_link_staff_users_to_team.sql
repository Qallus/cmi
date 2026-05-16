-- ============================================================
-- CMI WebApp - Link staff users to public team profiles
-- Date: 2026-05-16
--
-- Purpose:
--   Connect dashboard access records to public team profile records
--   so Team remains the public profile manager and Users remains the
--   account/permissions manager.
-- ============================================================

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_staff_users_team_member ON staff_users(team_member_id);

-- Best-effort backfill by email where both sides already exist.
UPDATE staff_users su
SET team_member_id = tm.id,
    updated_at = NOW()
FROM team_members tm
WHERE su.team_member_id IS NULL
  AND su.email IS NOT NULL
  AND tm.email IS NOT NULL
  AND lower(su.email) = lower(tm.email);
