-- User Management Phase 1 foundation.
-- Extends the existing RBAC/staff_users model and links managed users to contacts.

INSERT INTO roles (slug, label, description, dashboard_path, sort_order) VALUES
  ('admin', 'Admin', 'Operational admin access for users, projects, tasks, clients, vendors, and reports.', '/dashboard/users', 15),
  ('project_manager', 'Project Manager', 'Manage assigned projects, schedules, tasks, punch lists, and client-visible updates.', '/dashboard/project-manager', 22),
  ('designer', 'Designer', 'Access design-related tasks, selections, project files, and approvals.', '/dashboard/project-manager', 24),
  ('estimator', 'Estimator', 'Access leads, estimates, proposals, scopes, and pre-construction records.', '/dashboard/quotes-leads', 26),
  ('superintendent', 'Superintendent', 'Manage field schedules, inspections, site notes, photos, and punch items.', '/dashboard/project-manager', 28),
  ('viewer', 'Viewer', 'Read-only access to permitted dashboard and project areas.', '/dashboard/overview', 90)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  dashboard_path = EXCLUDED.dashboard_path,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'staff_users'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'staff_users_status_check'
  ) THEN
    ALTER TABLE staff_users DROP CONSTRAINT staff_users_status_check;
  END IF;
END $$;

ALTER TABLE staff_users
  ADD CONSTRAINT staff_users_status_check
  CHECK (status IN ('invited','pending','active','disabled','removed','suspended','archived'));

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE staff_users
SET job_title = COALESCE(job_title, title),
    company_name = COALESCE(company_name, 'Constructed Matter, Inc.'),
    updated_at = NOW()
WHERE job_title IS NULL OR company_name IS NULL;

CREATE TABLE IF NOT EXISTS user_project_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_role TEXT,
  assigned_by_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages user project assignments" ON user_project_assignments;
CREATE POLICY "Service role manages user project assignments"
  ON user_project_assignments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages user activity logs" ON user_activity_logs;
CREATE POLICY "Service role manages user activity logs"
  ON user_activity_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_staff_users_contact ON staff_users(contact_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_status ON staff_users(status);
CREATE INDEX IF NOT EXISTS idx_staff_users_company ON staff_users(company_name);
CREATE INDEX IF NOT EXISTS idx_user_project_assignments_user ON user_project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_assignments_project ON user_project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON user_activity_logs(user_id, created_at DESC);
