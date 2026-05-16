-- ============================================================
-- CMI WebApp - RBAC Phase 1/2 foundation
-- Date: 2026-05-15
--
-- Purpose:
--   Add the durable role, permission, profile, and organization
--   model needed before tightening dashboard access.
--
-- Notes:
--   - Do not store passwords here. Create passwords through
--     Supabase Auth or the chosen identity provider.
--   - Existing permissive anon policies are intentionally not
--     dropped in this migration so the current dashboard does not
--     break before Phase 3 auth/RLS work is complete.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Future SaaS tenant boundary. CMI is the first tenant.
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'owner'
    CHECK (type IN ('owner','client','vendor','subcontractor','partner')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO organizations (name, slug, type, status)
VALUES ('Constructed Matter, Inc.', 'constructed-matter', 'owner', 'active')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    updated_at = NOW();

-- User profiles are attached to Supabase Auth users once those users exist.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  title TEXT,
  phone TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited','active','disabled','archived')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  dashboard_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (slug, label, description, dashboard_path, sort_order) VALUES
  ('super_admin', 'Super Admin', 'Full platform access, including users, settings, integrations, and all records.', '/dashboard/admin', 10),
  ('staff', 'Staff', 'Internal CMI team access to project, client, communications, documents, and operations tools.', '/dashboard/staff', 20),
  ('subcontractor', 'Subcontractor', 'Assigned project, task, bid, SOW, upload, invoice, and communication access.', '/dashboard/subcontractor', 30),
  ('vendor', 'Vendor', 'Own company, product, pricing, availability, quote request, file, and message access.', '/dashboard/vendor', 40),
  ('client', 'Client', 'Assigned project, milestone, approved quote, document, invoice, message, and progress access.', '/dashboard/client', 50)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    dashboard_path = EXCLUDED.dashboard_path,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO permissions (key, label, category, description) VALUES
  ('users.view', 'View Users', 'users', 'View user accounts and access records.'),
  ('users.create', 'Create Users', 'users', 'Invite or create user accounts.'),
  ('users.edit', 'Edit Users', 'users', 'Edit user profile, status, roles, or access.'),
  ('users.delete', 'Delete Users', 'users', 'Remove or archive users.'),
  ('settings.manage', 'Manage Settings', 'settings', 'Manage global app, integration, and webhook settings.'),
  ('activity.view_all', 'View All Activity', 'activity', 'View all platform activity and audit logs.'),
  ('projects.view_all', 'View All Projects', 'projects', 'View every project in the tenant.'),
  ('projects.view_assigned', 'View Assigned Projects', 'projects', 'View projects assigned to the current user or company.'),
  ('projects.create', 'Create Projects', 'projects', 'Create internal operational projects.'),
  ('projects.edit', 'Edit Projects', 'projects', 'Edit project details, status, and assignments.'),
  ('projects.delete', 'Delete Projects', 'projects', 'Delete or archive projects.'),
  ('contacts.view', 'View Contacts', 'contacts', 'View contacts and client records.'),
  ('contacts.create', 'Create Contacts', 'contacts', 'Create client, lead, vendor, or subcontractor contacts.'),
  ('contacts.edit', 'Edit Contacts', 'contacts', 'Edit contact details and metadata.'),
  ('communications.view', 'View Communications', 'communications', 'View messages, email, SMS, calls, and notifications.'),
  ('communications.send', 'Send Communications', 'communications', 'Send messages, email, SMS, and notifications.'),
  ('calendars.view', 'View Calendars', 'calendars', 'View booking and project calendars.'),
  ('calendars.manage', 'Manage Calendars', 'calendars', 'Create, update, or cancel appointments and schedule items.'),
  ('quotes.view', 'View Quotes', 'quotes', 'View quote and lead records.'),
  ('quotes.create', 'Create Quotes', 'quotes', 'Create quote records.'),
  ('quotes.edit', 'Edit Quotes', 'quotes', 'Edit quote and lead status/details.'),
  ('bids.view', 'View Bids', 'bids', 'View bid requests and submitted bids.'),
  ('bids.submit', 'Submit Bids', 'bids', 'Submit or revise bids.'),
  ('sows.view', 'View SOWs', 'documents', 'View scope of work documents.'),
  ('sows.create', 'Create SOWs', 'documents', 'Create scope of work documents.'),
  ('documents.view', 'View Documents', 'documents', 'View contracts, SOWs, files, and project documents.'),
  ('documents.create', 'Create Documents', 'documents', 'Create contracts, SOWs, and internal documents.'),
  ('documents.edit', 'Edit Documents', 'documents', 'Edit contracts, SOWs, and internal documents.'),
  ('invoices.view', 'View Invoices', 'billing', 'View invoices and payment status.'),
  ('invoices.create', 'Create Invoices', 'billing', 'Create invoices.'),
  ('invoices.edit', 'Edit Invoices', 'billing', 'Edit invoices and payment metadata.'),
  ('products.view', 'View Products', 'products', 'View vendor products and catalogs.'),
  ('products.create', 'Create Products', 'products', 'Create vendor products.'),
  ('products.edit', 'Edit Products', 'products', 'Edit product details, pricing, and availability.'),
  ('products.delete', 'Delete Products', 'products', 'Delete or archive products.'),
  ('profile.view', 'View Profile', 'profile', 'View own profile.'),
  ('profile.edit', 'Edit Profile', 'profile', 'Edit own profile.'),
  ('notifications.view', 'View Notifications', 'notifications', 'View notifications.'),
  ('files.upload', 'Upload Files', 'files', 'Upload project, product, or document files.'),
  ('files.view', 'View Files', 'files', 'View allowed project, product, or document files.')
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_slug TEXT NOT NULL REFERENCES roles(slug) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_slug, permission_key)
);

-- Super Admin gets every permission.
INSERT INTO role_permissions (role_slug, permission_key)
SELECT 'super_admin', key FROM permissions
ON CONFLICT DO NOTHING;

-- Staff gets broad operational access but not global user/settings delete/admin control.
INSERT INTO role_permissions (role_slug, permission_key)
SELECT 'staff', key
FROM permissions
WHERE key IN (
  'projects.view_all','projects.view_assigned','projects.create','projects.edit',
  'contacts.view','contacts.create','contacts.edit',
  'communications.view','communications.send',
  'calendars.view','calendars.manage',
  'quotes.view','quotes.create','quotes.edit',
  'bids.view','sows.view','sows.create',
  'documents.view','documents.create','documents.edit',
  'invoices.view',
  'profile.view','profile.edit','notifications.view','files.upload','files.view'
)
ON CONFLICT DO NOTHING;

-- Subcontractors operate only on assigned work.
INSERT INTO role_permissions (role_slug, permission_key)
SELECT 'subcontractor', key
FROM permissions
WHERE key IN (
  'projects.view_assigned',
  'communications.view','communications.send',
  'calendars.view',
  'quotes.view',
  'bids.view','bids.submit',
  'sows.view','documents.view',
  'invoices.view','invoices.create',
  'profile.view','profile.edit','notifications.view','files.upload','files.view'
)
ON CONFLICT DO NOTHING;

-- Vendors manage their own catalog and related requests.
INSERT INTO role_permissions (role_slug, permission_key)
SELECT 'vendor', key
FROM permissions
WHERE key IN (
  'projects.view_assigned',
  'communications.view','communications.send',
  'quotes.view',
  'products.view','products.create','products.edit','products.delete',
  'profile.view','profile.edit','notifications.view','files.upload','files.view'
)
ON CONFLICT DO NOTHING;

-- Clients get polished project visibility without internal-only access.
INSERT INTO role_permissions (role_slug, permission_key)
SELECT 'client', key
FROM permissions
WHERE key IN (
  'projects.view_assigned',
  'communications.view','communications.send',
  'calendars.view',
  'quotes.view',
  'sows.view','documents.view',
  'invoices.view',
  'profile.view','profile.edit','notifications.view','files.upload','files.view'
)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_slug TEXT NOT NULL REFERENCES roles(slug) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role_slug, organization_id)
);

-- Pre-auth directory for invited/known users. This lets the dashboard
-- bootstrap role intent by email until Supabase Auth users are created.
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  title TEXT,
  role_slug TEXT NOT NULL REFERENCES roles(slug),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','disabled','archived')),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

WITH cmi AS (
  SELECT id FROM organizations WHERE slug = 'constructed-matter'
)
INSERT INTO staff_users (organization_id, email, first_name, last_name, display_name, title, role_slug, status)
SELECT cmi.id, v.email, v.first_name, v.last_name, v.display_name, v.title, v.role_slug, 'invited'
FROM cmi
CROSS JOIN (VALUES
  ('jeremy@constructedmatter.com', 'Jeremy', 'Waters', 'Jeremy Waters', 'Web Master', 'super_admin'),
  ('brandon@constructedmatter.com', 'Brandon', 'Fadden', 'Brandon Fadden', 'Principal / President', 'super_admin'),
  ('joe@constructedmatter.com', 'Joe', 'Ballard', 'Joe Ballard', 'Managing Partner', 'super_admin'),
  ('ben@constructedmatter.com', 'Ben', 'Peck', 'Ben Peck', 'Project Manager', 'staff'),
  ('angel@constructedmatter.com', 'Angel', 'Gutierrez', 'Angel Gutierrez', 'Field Operations Coordinator', 'staff'),
  ('yovana@constructedmatter.com', 'Yovana', 'Hernanez', 'Yovana Hernanez', 'Executive Operations & Project Coordinator', 'staff')
) AS v(email, first_name, last_name, display_name, title, role_slug)
ON CONFLICT (email) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    display_name = EXCLUDED.display_name,
    title = EXCLUDED.title,
    role_slug = EXCLUDED.role_slug,
    organization_id = EXCLUDED.organization_id,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_slug TEXT NOT NULL REFERENCES roles(slug),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disabled','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL
    CHECK (member_type IN ('staff','client','subcontractor','vendor')),
  role_label TEXT,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_upload BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR contact_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  role_slug TEXT REFERENCES roles(slug) ON DELETE SET NULL,
  permission_key TEXT REFERENCES permissions(key) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep updated_at fresh on RBAC tables.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','profiles','roles','staff_users',
    'organization_members','project_members'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- Phase 2 read policies: authenticated users can read role metadata needed
-- to build their UI. Phase 3 should add stricter admin/staff policies and
-- remove permissive anon policies from existing operational tables.
CREATE POLICY "authenticated_read_roles" ON roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_permissions" ON permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_role_permissions" ON role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_own_profile" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "authenticated_update_own_profile" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "authenticated_read_own_user_roles" ON user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_role ON staff_users(role_slug);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_contact ON project_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_actor ON permission_audit_logs(actor_user_id);
