-- Portfolio dashboard media/detail fields for the Next app.
-- Run after the base portfolio table exists.

ALTER TABLE portfolio
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS video_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS services_used TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS attributes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_portfolio_status ON portfolio(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_featured ON portfolio(is_featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio(category);

ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_authenticated_all" ON portfolio;
CREATE POLICY "portfolio_authenticated_all"
  ON portfolio
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "portfolio_public_published_read" ON portfolio;
CREATE POLICY "portfolio_public_published_read"
  ON portfolio
  FOR SELECT
  TO anon
  USING (status = 'published' AND COALESCE(client_visible, true) = true);
