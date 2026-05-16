-- ============================================================
-- CMI Production Extensions
-- Run after supabase/schema.sql.
-- Covers: client project pages, share links, QR codes, SMS,
-- bulk messaging, inbound Twilio webhooks, and Bolt Agent audit.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Public/client project pages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id         UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  public_status     TEXT NOT NULL DEFAULT 'private'
                    CHECK (public_status IN ('private','client','shared','public')),
  summary           TEXT,
  hero_image_url    TEXT,
  project_manager   TEXT,
  phase             TEXT,
  percent_complete  INTEGER DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  start_date        DATE,
  target_date       DATE,
  published_at      TIMESTAMPTZ,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming','active','blocked','complete')),
  sort_order        INTEGER DEFAULT 0,
  due_date          DATE,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_updates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  body              TEXT,
  visibility        TEXT NOT NULL DEFAULT 'client'
                    CHECK (visibility IN ('internal','client','vendor','public')),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','needs_approval','published','archived')),
  author_name       TEXT,
  hermes_run_id     UUID,
  published_at      TIMESTAMPTZ,
  notify_sms        BOOLEAN DEFAULT FALSE,
  notify_email      BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_update_media (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_update_id UUID NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
  media_url         TEXT NOT NULL,
  media_type        TEXT NOT NULL DEFAULT 'image'
                    CHECK (media_type IN ('image','video','document')),
  caption           TEXT,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_share_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  token             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  label             TEXT,
  access_level      TEXT NOT NULL DEFAULT 'client_read'
                    CHECK (access_level IN ('client_read','vendor_read','public_read','update_only')),
  expires_at        TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  scan_count        INTEGER NOT NULL DEFAULT 0,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_qr_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id     UUID NOT NULL REFERENCES project_share_links(id) ON DELETE CASCADE,
  qr_image_url      TEXT,
  target_url        TEXT NOT NULL,
  label             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  project_update_id UUID REFERENCES project_updates(id) ON DELETE CASCADE,
  author_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  author_name       TEXT,
  body              TEXT NOT NULL,
  visibility        TEXT NOT NULL DEFAULT 'client'
                    CHECK (visibility IN ('internal','client','vendor','public')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Twilio / messaging
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  client_project_id UUID REFERENCES client_projects(id) ON DELETE SET NULL,
  channel           TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','email')),
  subject           TEXT,
  last_message_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         UUID REFERENCES message_threads(id) ON DELETE SET NULL,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel           TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','email')),
  from_address      TEXT,
  to_address        TEXT,
  body              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued',
  provider          TEXT DEFAULT 'twilio',
  provider_sid      TEXT UNIQUE,
  error_message     TEXT,
  sent_by           UUID,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','email')),
  body              TEXT NOT NULL,
  category          TEXT,
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulk_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','email')),
  segment_query     JSONB,
  template_id       UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  body              TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','queued','sending','sent','failed','cancelled')),
  created_by        UUID,
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulk_campaign_recipients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES bulk_campaigns(id) ON DELETE CASCADE,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  phone             TEXT,
  status            TEXT NOT NULL DEFAULT 'queued',
  message_id        UUID REFERENCES messages(id) ON DELETE SET NULL,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             TEXT UNIQUE NOT NULL,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  reason            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS twilio_webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        TEXT NOT NULL,
  provider_sid      TEXT,
  payload           JSONB NOT NULL,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Bolt Agent
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hermes_agent_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','needs_approval','approved','rejected','completed','failed')),
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  client_project_id UUID REFERENCES client_projects(id) ON DELETE SET NULL,
  input             JSONB,
  output            JSONB,
  error_message     TEXT,
  requested_by      UUID,
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hermes_agent_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES hermes_agent_runs(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content           TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hermes_agent_approvals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES hermes_agent_runs(id) ON DELETE CASCADE,
  approval_type     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  proposed_payload  JSONB,
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- RLS hardening
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "anon_all_contacts" ON contacts;
DROP POLICY IF EXISTS "anon_all_projects" ON projects;
DROP POLICY IF EXISTS "anon_all_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_all_quotes" ON quotes;
DROP POLICY IF EXISTS "anon_all_documents" ON documents;
DROP POLICY IF EXISTS "anon_all_portfolio" ON portfolio;
DROP POLICY IF EXISTS "anon_all_team" ON team_members;
DROP POLICY IF EXISTS "anon_all_blog" ON blog_posts;

ALTER TABLE client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_update_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hermes_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hermes_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hermes_agent_approvals ENABLE ROW LEVEL SECURITY;

-- Dashboard/API access: authenticated users only. Use service role in backend
-- jobs/webhooks when bypassing RLS is required.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts','projects','bookings','quotes','documents',
    'portfolio','team_members','blog_posts',
    'client_projects','project_milestones','project_updates',
    'project_update_media','project_share_links','project_qr_codes',
    'project_comments','message_threads','messages','message_templates',
    'bulk_campaigns','bulk_campaign_recipients','sms_opt_outs',
    'twilio_webhook_events','hermes_agent_runs','hermes_agent_messages',
    'hermes_agent_approvals'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- Public content can be read anonymously.
DROP POLICY IF EXISTS "portfolio_public_read" ON portfolio;
CREATE POLICY "portfolio_public_read" ON portfolio
  FOR SELECT TO anon USING (status = 'published');

DROP POLICY IF EXISTS "team_public_read" ON team_members;
CREATE POLICY "team_public_read" ON team_members
  FOR SELECT TO anon USING (status = 'active');

DROP POLICY IF EXISTS "blog_public_read" ON blog_posts;
CREATE POLICY "blog_public_read" ON blog_posts
  FOR SELECT TO anon USING (status = 'published');

CREATE INDEX IF NOT EXISTS idx_client_projects_slug ON client_projects(slug);
CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(client_project_id);
CREATE INDEX IF NOT EXISTS idx_project_share_links_token ON project_share_links(token);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_provider_sid ON messages(provider_sid);
CREATE INDEX IF NOT EXISTS idx_bulk_recipients_campaign ON bulk_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_hermes_runs_project ON hermes_agent_runs(client_project_id);
