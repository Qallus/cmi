-- ============================================================
-- CMI WebApp - Live Page Editor (Super Admin visual review)
-- Date: 2026-07-01
--
-- Purpose:
--   Store Super Admin visual page-review sessions, the elements
--   inspected on each page, the notes attached to those elements,
--   and export records (structured / AI-readable briefs).
--
--   All data is PRIVATE. There is no public-read policy — only the
--   service role (the Next.js app, after its own Super Admin check)
--   may read or write these tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS page_review_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id TEXT,
  page_url TEXT,
  page_title TEXT,
  page_slug TEXT NOT NULL,
  created_by TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_review_elements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_session_id UUID NOT NULL REFERENCES page_review_sessions(id) ON DELETE CASCADE,
  page_id TEXT,
  page_url TEXT,
  page_slug TEXT,
  element_type TEXT,
  element_label TEXT,
  heading_text TEXT,
  heading_level INT,
  section_order INT,
  parent_section_id UUID REFERENCES page_review_elements(id) ON DELETE SET NULL,
  parent_container_id UUID REFERENCES page_review_elements(id) ON DELETE SET NULL,
  parent_row_id UUID REFERENCES page_review_elements(id) ON DELETE SET NULL,
  parent_column_id UUID REFERENCES page_review_elements(id) ON DELETE SET NULL,
  parent_section_label TEXT,
  dom_selector TEXT,
  dom_path TEXT,
  css_classes TEXT,
  component_name TEXT,
  cms_block_id UUID,
  element_ref TEXT,
  bounding_box_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  screenshot_url TEXT,
  content_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_review_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_session_id UUID NOT NULL REFERENCES page_review_sessions(id) ON DELETE CASCADE,
  element_id UUID REFERENCES page_review_elements(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft','open','in_progress','resolved','archived')),
  change_type TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS page_review_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_session_id UUID NOT NULL REFERENCES page_review_sessions(id) ON DELETE CASCADE,
  file_url TEXT,
  file_type TEXT NOT NULL DEFAULT 'markdown',
  export_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ai_visible BOOLEAN NOT NULL DEFAULT false,
  ai_processed_at TIMESTAMPTZ
);

ALTER TABLE page_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_review_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_review_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_review_exports ENABLE ROW LEVEL SECURITY;

-- Service-role-only access. These records are never exposed to the public
-- or to normal authenticated users directly; the app enforces Super Admin.
DROP POLICY IF EXISTS "Service role manages page review sessions" ON page_review_sessions;
CREATE POLICY "Service role manages page review sessions"
  ON page_review_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages page review elements" ON page_review_elements;
CREATE POLICY "Service role manages page review elements"
  ON page_review_elements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages page review notes" ON page_review_notes;
CREATE POLICY "Service role manages page review notes"
  ON page_review_notes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages page review exports" ON page_review_exports;
CREATE POLICY "Service role manages page review exports"
  ON page_review_exports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_page_review_sessions_slug ON page_review_sessions(page_slug);
CREATE INDEX IF NOT EXISTS idx_page_review_sessions_status ON page_review_sessions(status);
CREATE INDEX IF NOT EXISTS idx_page_review_elements_session ON page_review_elements(review_session_id);
CREATE INDEX IF NOT EXISTS idx_page_review_elements_ref ON page_review_elements(element_ref);
CREATE INDEX IF NOT EXISTS idx_page_review_notes_session ON page_review_notes(review_session_id);
CREATE INDEX IF NOT EXISTS idx_page_review_notes_element ON page_review_notes(element_id);
CREATE INDEX IF NOT EXISTS idx_page_review_exports_session ON page_review_exports(review_session_id);
