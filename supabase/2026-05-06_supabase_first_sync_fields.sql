-- ============================================================
-- CMI WebApp - Supabase-first sync fields
-- Date: 2026-05-06
--
-- Purpose:
--   Keep dashboard saves independent in Supabase while allowing
--   WordPress / Fluent plugin sync to run as a secondary process.
-- ============================================================

-- Portfolio dashboard currently writes these fields.
ALTER TABLE portfolio
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timeline TEXT,
  ADD COLUMN IF NOT EXISTS square_feet INTEGER,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Team is Supabase-first. WordPress fields remain optional for future sync.
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS attributes_json JSONB,
  ADD COLUMN IF NOT EXISTS schedule_json JSONB,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Documents are local operational records with optional downstream email/PDF/signature sync.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_status TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Integration observability.
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  external_id TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT,
  external_id TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'resend',
  entity_type TEXT,
  entity_id TEXT,
  to_email TEXT,
  from_email TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_project ON portfolio(project_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_sync_status ON portfolio(sync_status);
CREATE INDEX IF NOT EXISTS idx_team_sync_status ON team_members(sync_status);
CREATE INDEX IF NOT EXISTS idx_documents_contact ON documents(contact_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_sync_status ON documents(sync_status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_entity ON integration_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider, event_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_entity ON email_logs(entity_type, entity_id);
