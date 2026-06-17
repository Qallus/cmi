-- Add sort_order and featured columns to blog_posts
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS sort_order  INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS blog_posts_sort_order_idx ON blog_posts (sort_order ASC);
