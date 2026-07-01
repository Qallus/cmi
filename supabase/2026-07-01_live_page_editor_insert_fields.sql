-- ============================================================
-- CMI WebApp - Live Page Editor: addition / insert request fields
-- Date: 2026-07-01
--
-- "Addition" requests (the + between sections) can specify what to add
-- (section / row / column / card / component) and, for components, a ShadCN
-- component name to base it on.
-- ============================================================

ALTER TABLE page_review_notes
  ADD COLUMN IF NOT EXISTS insert_kind TEXT,
  ADD COLUMN IF NOT EXISTS component_name TEXT;
