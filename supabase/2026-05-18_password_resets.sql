-- ============================================================
-- CMI WebApp - Portal password reset support
-- Date: 2026-05-18
--
-- Purpose:
--   Add database-backed password credentials and single-use reset
--   tokens for invited portal users across staff, clients, vendors,
--   subcontractors, and future roles.
-- ============================================================

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages password reset tokens" ON password_reset_tokens;
CREATE POLICY "Service role manages password reset tokens"
  ON password_reset_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

