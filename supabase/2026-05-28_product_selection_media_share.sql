-- Product selection media, import/export, and share support.
-- Run after 2026-05-28_product_selection_phase1.sql.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE project_selections
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS video_url TEXT;

CREATE TABLE IF NOT EXISTS selection_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('product','selection')),
  resource_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','link')),
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_type TEXT CHECK (recipient_type IN ('client','vendor','subcontractor','staff','other')),
  subject TEXT,
  message TEXT,
  share_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_selection_share_events_resource ON selection_share_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_selection_share_events_status ON selection_share_events(status, created_at);

ALTER TABLE selection_share_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "selection_share_events_authenticated_all" ON selection_share_events;
CREATE POLICY "selection_share_events_authenticated_all"
  ON selection_share_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
