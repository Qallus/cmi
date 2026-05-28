-- Project/task media, selections, and jurisdiction code references.
-- Run after project schedule and user management migrations.

CREATE TABLE IF NOT EXISTS project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_schedule_item_id UUID REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo','video')),
  title TEXT,
  caption TEXT,
  file_url TEXT NOT NULL,
  storage_bucket TEXT,
  storage_path TEXT,
  capture_source TEXT CHECK (capture_source IN ('upload','front_camera','rear_camera','unknown')),
  client_visible BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS selection_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  website_url TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_schedule_item_id UUID REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES selection_vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,
  name TEXT NOT NULL,
  category TEXT,
  manufacturer TEXT,
  sku TEXT,
  model_number TEXT,
  description TEXT,
  image_url TEXT,
  product_url TEXT,
  price NUMERIC(12,2),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','available','delivery','out_of_stock','discontinued','approved','rejected','needs_review')),
  delivery_date DATE,
  lead_time_days INTEGER,
  client_approval_status TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (client_approval_status IN ('not_sent','pending','approved','rejected','revision_requested')),
  client_visible BOOLEAN NOT NULL DEFAULT false,
  internal_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_code_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_schedule_item_id UUID REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  added_by_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  jurisdiction_type TEXT NOT NULL DEFAULT 'city'
    CHECK (jurisdiction_type IN ('city','county','state','federal','hoa','other')),
  jurisdiction_name TEXT,
  code_source TEXT,
  code_section TEXT,
  code_text TEXT,
  source_url TEXT,
  applies_to_phase TEXT,
  required_inspection TEXT,
  compliance_status TEXT NOT NULL DEFAULT 'not_reviewed'
    CHECK (compliance_status IN ('not_reviewed','applicable','satisfied','issue','not_applicable')),
  notes TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_media_project ON project_media(project_id);
CREATE INDEX IF NOT EXISTS idx_project_media_schedule_item ON project_media(project_schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_project_selections_project ON project_selections(project_id);
CREATE INDEX IF NOT EXISTS idx_project_selections_schedule_item ON project_selections(project_schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_project_selections_status ON project_selections(status);
CREATE INDEX IF NOT EXISTS idx_project_code_references_project ON project_code_references(project_id);
CREATE INDEX IF NOT EXISTS idx_project_code_references_schedule_item ON project_code_references(project_schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_project_code_references_status ON project_code_references(compliance_status);

ALTER TABLE project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_code_references ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'project_media',
    'selection_vendors',
    'project_selections',
    'project_code_references'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
