-- Email templates for the dashboard template builder
CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  subject       TEXT        NOT NULL DEFAULT '',
  preview_text  TEXT        NOT NULL DEFAULT '',
  builder_type  TEXT        NOT NULL DEFAULT 'html' CHECK (builder_type IN ('visual', 'html')),
  blocks        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  html          TEXT        NOT NULL DEFAULT '',
  trigger_event TEXT        DEFAULT NULL,
  status        TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON email_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS email_templates_status_idx ON email_templates (status);
CREATE INDEX IF NOT EXISTS email_templates_trigger_idx ON email_templates (trigger_event);
