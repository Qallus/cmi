-- Integration log table/fields used by dashboard actions such as Blog Email Blast.
-- Safe to run more than once. Supports both the older provider/action log shape
-- and the newer source/event_type/payload shape used by Next.js API routes.

CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'app',
  direction TEXT NOT NULL DEFAULT 'outbound',
  entity_type TEXT NOT NULL DEFAULT 'system',
  entity_id TEXT,
  external_id TEXT,
  action TEXT NOT NULL DEFAULT 'event',
  source TEXT,
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE integration_logs
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_payload JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_integration_logs_provider_action
  ON integration_logs(provider, action);

CREATE INDEX IF NOT EXISTS idx_integration_logs_source_event
  ON integration_logs(source, event_type);

CREATE INDEX IF NOT EXISTS idx_integration_logs_entity
  ON integration_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at
  ON integration_logs(created_at DESC);

ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_logs_authenticated_read" ON integration_logs;
CREATE POLICY "integration_logs_authenticated_read"
  ON integration_logs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "integration_logs_service_role_all" ON integration_logs;
CREATE POLICY "integration_logs_service_role_all"
  ON integration_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
