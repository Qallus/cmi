-- ============================================================
-- CMI WebApp - User invitations and site content controls
-- Date: 2026-05-16
--
-- Purpose:
--   Add durable records for invite history and editable sitewide
--   content blocks controlled from the Super Admin dashboard.
-- ============================================================

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS invite_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_sms_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  name TEXT,
  role_slug TEXT NOT NULL REFERENCES roles(slug),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  notify_sms BOOLEAN NOT NULL DEFAULT false,
  email_status TEXT,
  sms_status TEXT,
  invited_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_content_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('hero','notification','cta')),
  title TEXT,
  subtitle TEXT,
  body TEXT,
  button_label TEXT,
  button_url TEXT,
  image_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  pages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages user invites" ON user_invites;
CREATE POLICY "Service role manages user invites"
  ON user_invites FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public can read enabled site content" ON site_content_blocks;
CREATE POLICY "Public can read enabled site content"
  ON site_content_blocks FOR SELECT
  USING (enabled = true OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages site content" ON site_content_blocks;
CREATE POLICY "Service role manages site content"
  ON site_content_blocks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_role ON user_invites(role_slug);
CREATE INDEX IF NOT EXISTS idx_site_content_blocks_type ON site_content_blocks(type);
CREATE INDEX IF NOT EXISTS idx_site_content_blocks_pages ON site_content_blocks USING GIN(pages);
