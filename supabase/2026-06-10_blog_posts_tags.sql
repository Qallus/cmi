-- Adds dashboard blog fields expected by the Next.js blog editor.
-- Safe to run more than once.

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS tags TEXT[];

CREATE INDEX IF NOT EXISTS blog_posts_tags_gin_idx
  ON blog_posts USING GIN (tags);
