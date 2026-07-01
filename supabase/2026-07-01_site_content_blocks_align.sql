-- ============================================================
-- CMI WebApp - Align site_content_blocks with the dashboard model
-- Date: 2026-07-01
--
-- The Site Content dashboard reads/writes this table, but:
--   * it treats `pages` as a comma string ("*", "/home, /about"), while the
--     column was TEXT[]; and
--   * it offers 6 block types (hero, notification, cta, section, banner,
--     custom), while the CHECK only allowed 3.
-- The dashboard also previously queried a non-existent `site_content` table;
-- the app now points at `site_content_blocks`. Table is empty, so the column
-- conversions below are safe.
-- ============================================================

DROP INDEX IF EXISTS idx_site_content_blocks_pages;

ALTER TABLE site_content_blocks ALTER COLUMN pages DROP DEFAULT;
ALTER TABLE site_content_blocks
  ALTER COLUMN pages TYPE TEXT USING array_to_string(pages, ',');
ALTER TABLE site_content_blocks ALTER COLUMN pages SET DEFAULT '*';

ALTER TABLE site_content_blocks DROP CONSTRAINT IF EXISTS site_content_blocks_type_check;
ALTER TABLE site_content_blocks
  ADD CONSTRAINT site_content_blocks_type_check
  CHECK (type IN ('hero','notification','cta','section','banner','custom'));

CREATE INDEX IF NOT EXISTS idx_site_content_blocks_pages ON site_content_blocks(pages);
