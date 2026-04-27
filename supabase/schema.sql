-- ============================================================
-- CMI WebApp — Supabase Schema
-- Project: uoerzrmeibavqgisfzso
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Contacts (synced with FluentCRM) ────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  fluent_crm_id   INTEGER     UNIQUE,
  first_name      TEXT        NOT NULL DEFAULT '',
  last_name       TEXT        NOT NULL DEFAULT '',
  email           TEXT        UNIQUE NOT NULL,
  phone           TEXT,
  company         TEXT,
  type            TEXT        DEFAULT 'Lead'
                  CHECK (type IN ('Client','Lead','Vendor','Sub Contractor')),
  status          TEXT        DEFAULT 'active',
  address         TEXT,
  city            TEXT,
  state           TEXT        DEFAULT 'AZ',
  zip             TEXT,
  notes           TEXT,
  tags            TEXT[],
  source          TEXT,
  last_activity   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Projects (synced with Fluent Boards Pro) ────────────────
CREATE TABLE IF NOT EXISTS projects (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  fluent_board_id INTEGER,
  fluent_task_id  INTEGER     UNIQUE,
  title           TEXT        NOT NULL,
  description     TEXT,
  client_id       UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  status          TEXT        DEFAULT 'active',
  stage           TEXT,
  priority        TEXT        DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  category        TEXT,
  location        TEXT,
  sq_ft           INTEGER,
  budget          NUMERIC(12,2),
  start_date      DATE,
  due_date        DATE,
  completed_date  DATE,
  board_name      TEXT,
  assignees       TEXT[],
  tags            TEXT[],
  image_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bookings (synced via Fluent Booking → FluentCRM) ────────
CREATE TABLE IF NOT EXISTS bookings (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  fluent_booking_id INTEGER     UNIQUE,
  contact_id        UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  booking_type      TEXT        NOT NULL DEFAULT 'Consultation',
  title             TEXT,
  start_datetime    TIMESTAMPTZ,
  end_datetime      TIMESTAMPTZ,
  status            TEXT        DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','cancelled','completed')),
  location          TEXT,
  meeting_url       TEXT,
  notes             TEXT,
  host_name         TEXT,
  host_email        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Quotes / Leads (from website quote form) ────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  fluent_crm_id   INTEGER,
  contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  email           TEXT,
  phone           TEXT,
  project_type    TEXT,
  location        TEXT,
  sq_ft           INTEGER,
  budget_range    TEXT,
  timeline        TEXT,
  services        TEXT[],
  description     TEXT,
  status          TEXT        DEFAULT 'New'
                  CHECK (status IN ('New','In Review','Quoted','Won','Lost')),
  estimated_value NUMERIC(12,2),
  source          TEXT        DEFAULT 'Website',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Documents (Contracts & SOWs) ────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                TEXT        PRIMARY KEY,
  type              TEXT        NOT NULL CHECK (type IN ('contract','sow')),
  title             TEXT        NOT NULL,
  client            TEXT,
  client_email      TEXT,
  client_phone      TEXT,
  project           TEXT,
  location          TEXT,
  date              TEXT,
  start_date        TEXT,
  completion_date   TEXT,
  value             TEXT,
  deposit           TEXT,
  payment_schedule  TEXT,
  payment_terms     TEXT,
  allowances        TEXT,
  sq_ft             TEXT,
  services          TEXT,
  description       TEXT,
  deliverables      TEXT,
  exclusions        TEXT,
  assumptions       TEXT,
  warranty          TEXT,
  change_order      TEXT,
  dispute           TEXT,
  permits           TEXT,
  inspections       TEXT,
  roc               TEXT        DEFAULT 'AZ ROC KB-1 #343120',
  cmi_rep           TEXT,
  prepared_by       TEXT,
  status            TEXT        DEFAULT 'Draft',
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Portfolio (synced with WordPress portfolio CPT) ─────────
CREATE TABLE IF NOT EXISTS portfolio (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  wp_post_id      INTEGER     UNIQUE,
  title           TEXT        NOT NULL,
  slug            TEXT        UNIQUE,
  category        TEXT,
  year            INTEGER,
  location        TEXT,
  description     TEXT,
  featured_image  TEXT,
  gallery_images  TEXT[],
  status          TEXT        DEFAULT 'published',
  sort_order      INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Team Members (synced with WordPress team CPT) ───────────
CREATE TABLE IF NOT EXISTS team_members (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  wp_post_id      INTEGER     UNIQUE,
  name            TEXT        NOT NULL,
  slug            TEXT        UNIQUE,
  role            TEXT,
  department      TEXT,
  bio             TEXT,
  tagline         TEXT,
  email           TEXT,
  phone           TEXT,
  profile_photo   TEXT,
  secondary_photo TEXT,
  attributes      TEXT[],
  availability    TEXT,
  sort_order      INTEGER     DEFAULT 0,
  status          TEXT        DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Blog Posts (synced with WordPress blog CPT) ─────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  wp_post_id      INTEGER     UNIQUE,
  title           TEXT        NOT NULL,
  slug            TEXT        UNIQUE,
  category        TEXT,
  excerpt         TEXT,
  content         TEXT,
  featured_image  TEXT,
  author          TEXT,
  status          TEXT        DEFAULT 'draft',
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Auto-update updated_at on every row change
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts','projects','bookings','quotes',
    'documents','portfolio','team_members','blog_posts'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ============================================================
-- Row Level Security
-- NOTE: policies are permissive for anon until Supabase Auth
--       is implemented. Tighten to "authenticated" role then.
-- ============================================================
ALTER TABLE contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio    ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts   ENABLE ROW LEVEL SECURITY;

-- Full CRUD for anon (dashboard has its own auth layer)
CREATE POLICY "anon_all_contacts"     ON contacts     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_projects"     ON projects     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_bookings"     ON bookings     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_quotes"       ON quotes       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_documents"    ON documents    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_portfolio"    ON portfolio    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_team"         ON team_members FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_blog"         ON blog_posts   FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_email         ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_fluent_id     ON contacts(fluent_crm_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type          ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_projects_fluent_task   ON projects(fluent_task_id);
CREATE INDEX IF NOT EXISTS idx_projects_client        ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start         ON bookings(start_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_quotes_status          ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_email           ON quotes(email);
CREATE INDEX IF NOT EXISTS idx_documents_type         ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status       ON documents(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_slug         ON portfolio(slug);
CREATE INDEX IF NOT EXISTS idx_team_slug              ON team_members(slug);
CREATE INDEX IF NOT EXISTS idx_blog_slug              ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_status            ON blog_posts(status);
