-- Product Selection Management phase 1.
-- Run after 2026-05-28_project_media_selections_codes.sql.

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_slug TEXT UNIQUE,
  category TEXT,
  product_type TEXT,
  brand TEXT,
  manufacturer TEXT,
  sku TEXT,
  model_number TEXT,
  vendor_id UUID REFERENCES selection_vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,
  description TEXT,
  image_url TEXT,
  spec_sheet_url TEXT,
  product_url TEXT,
  unit_cost NUMERIC(12,2),
  retail_price NUMERIC(12,2),
  markup_percent NUMERIC(8,2),
  lead_time_days INTEGER,
  availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available','limited','out_of_stock','discontinued','special_order','unknown')),
  warranty_info TEXT,
  install_notes TEXT,
  internal_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_selections
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS room_area_name TEXT,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_product_name TEXT,
  ADD COLUMN IF NOT EXISTS spec_sheet_url TEXT,
  ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcontractor_name TEXT,
  ADD COLUMN IF NOT EXISTS designer_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS designer_name TEXT,
  ADD COLUMN IF NOT EXISTS related_task_id UUID REFERENCES project_schedule_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sow_id TEXT,
  ADD COLUMN IF NOT EXISTS contract_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS selection_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (selection_status IN ('draft','needs_review','pending_client_approval','client_approved','rejected_needs_revision','approved_internally','ordered','backordered','delivered','installed','canceled','replaced','completed')),
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required','pending','approved','rejected','revision_requested','approved_with_changes')),
  ADD COLUMN IF NOT EXISTS procurement_status TEXT NOT NULL DEFAULT 'not_ordered'
    CHECK (procurement_status IN ('not_ordered','quote_requested','quote_received','ready_to_order','ordered','backordered','partially_delivered','delivered','canceled')),
  ADD COLUMN IF NOT EXISTS install_status TEXT NOT NULL DEFAULT 'not_ready'
    CHECK (install_status IN ('not_ready','ready_for_install','scheduled','in_progress','installed','needs_correction','completed')),
  ADD COLUMN IF NOT EXISTS client_approval_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_comments TEXT,
  ADD COLUMN IF NOT EXISTS allowance_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS client_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS over_under_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS markup_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_decision_date DATE,
  ADD COLUMN IF NOT EXISTS target_order_date DATE,
  ADD COLUMN IF NOT EXISTS target_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS target_install_date DATE,
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id) ON DELETE SET NULL;

UPDATE project_selections
SET
  project_name = COALESCE(project_name, metadata->>'project_title'),
  custom_product_name = COALESCE(custom_product_name, name),
  selection_status = COALESCE(selection_status, CASE
    WHEN status = 'approved' THEN 'approved_internally'
    WHEN status = 'delivery' THEN 'delivered'
    WHEN status = 'out_of_stock' THEN 'backordered'
    WHEN status = 'rejected' THEN 'rejected_needs_revision'
    WHEN status = 'needs_review' THEN 'needs_review'
    ELSE 'draft'
  END),
  approval_status = COALESCE(approval_status, CASE
    WHEN client_approval_status = 'approved' THEN 'approved'
    WHEN client_approval_status = 'rejected' THEN 'rejected'
    WHEN client_approval_status = 'revision_requested' THEN 'revision_requested'
    WHEN client_approval_status = 'pending' THEN 'pending'
    ELSE 'not_required'
  END),
  procurement_status = COALESCE(procurement_status, CASE
    WHEN status = 'delivery' THEN 'delivered'
    WHEN status = 'out_of_stock' THEN 'backordered'
    ELSE 'not_ordered'
  END),
  install_status = COALESCE(install_status, 'not_ready')
WHERE TRUE;

CREATE TABLE IF NOT EXISTS selection_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES project_selections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  comment_type TEXT NOT NULL DEFAULT 'internal' CHECK (comment_type IN ('internal','client','vendor','subcontractor','system')),
  comment_body TEXT NOT NULL,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS selection_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES project_selections(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  file_name TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  document_type TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS selection_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES project_selections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability_status);
CREATE INDEX IF NOT EXISTS idx_project_selections_product ON project_selections(product_id);
CREATE INDEX IF NOT EXISTS idx_project_selections_project_name ON project_selections(project_name);
CREATE INDEX IF NOT EXISTS idx_project_selections_room_area ON project_selections(room_area_name);
CREATE INDEX IF NOT EXISTS idx_project_selections_selection_status ON project_selections(selection_status);
CREATE INDEX IF NOT EXISTS idx_project_selections_approval_status ON project_selections(approval_status);
CREATE INDEX IF NOT EXISTS idx_project_selections_procurement_status ON project_selections(procurement_status);
CREATE INDEX IF NOT EXISTS idx_project_selections_install_status ON project_selections(install_status);
CREATE INDEX IF NOT EXISTS idx_project_selections_related_task ON project_selections(related_task_id);
CREATE INDEX IF NOT EXISTS idx_selection_comments_selection ON selection_comments(selection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_selection_documents_selection ON selection_documents(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_activity_selection ON selection_activity(selection_id, created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_activity ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products',
    'selection_comments',
    'selection_documents',
    'selection_activity'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
