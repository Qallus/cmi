-- Project billing relationship foundation.
-- Lets a project or schedule task connect to invoices, quotes, SOWs, contracts, payments, and billing records.

CREATE TABLE IF NOT EXISTS project_billing_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_schedule_item_id UUID REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('invoice','quote','sow','contract','payment','billing_record')),
  linked_record_id UUID,
  linked_record_label TEXT,
  amount NUMERIC(12,2),
  status TEXT,
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_billing_links_project ON project_billing_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_billing_links_schedule_item ON project_billing_links(project_schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_project_billing_links_type ON project_billing_links(link_type);

ALTER TABLE project_billing_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_billing_links_authenticated_all" ON project_billing_links;
CREATE POLICY "project_billing_links_authenticated_all"
  ON project_billing_links
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
