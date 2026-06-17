-- =============================================================================
-- Staff Users Initial Setup
-- Run this in the Supabase SQL Editor AFTER creating auth users via the
-- Supabase Dashboard → Authentication → Users → Add User.
--
-- IMPORTANT: Each email below must match exactly the email used when
-- creating that person's auth user in the Supabase dashboard.
--
-- Current auth users needed (6 total):
--   jeremy@constructedmatter.com
--   brandon@constructedmatter.com
--   joe@constructedmatter.com
--   yovana@constructedmatter.com
--   ben@constructedmatter.com
--   angel@constructedmatter.com
--
-- Available role_slug values:
--   'admin'           — Full dashboard access
--   'project_manager' — Projects, schedules, tasks, client updates
--   'designer'        — Selections, design tasks, project files
--   'estimator'       — Quotes, leads, proposals
--   'superintendent'  — Field schedules, site notes, inspections
--   'viewer'          — Read-only
-- =============================================================================

INSERT INTO staff_users (
  email,
  first_name,
  last_name,
  display_name,
  role_slug,
  title,
  job_title,
  company_name,
  status
)
VALUES
  -- ── Jeremy Waters ──────────────────────────────────────────────────────────
  (
    'jeremy@constructedmatter.com',
    'Jeremy', 'Waters', 'Jeremy Waters',
    'admin',
    'Channel Development',
    'Channel Development',
    'Constructed Matter, Inc.',
    'active'
  ),

  -- ── Brandon Fadden ─────────────────────────────────────────────────────────
  (
    'brandon@constructedmatter.com',
    'Brandon', 'Fadden', 'Brandon Fadden',
    'admin',
    'Principal / President',
    'Principal / President',
    'Constructed Matter, Inc.',
    'active'
  ),

  -- ── Joseph Ballard ─────────────────────────────────────────────────────────
  (
    'joe@constructedmatter.com',
    'Joseph', 'Ballard', 'Joseph Ballard',
    'admin',
    'Principal / Managing Partner',
    'Principal / Managing Partner',
    'Constructed Matter, Inc.',
    'active'
  ),

  -- ── Yovana Hernandez ───────────────────────────────────────────────────────
  (
    'yovana@constructedmatter.com',
    'Yovana', 'Hernandez', 'Yovana Hernandez',
    'admin',
    'Executive Operations & Project Coordinator',
    'Executive Operations & Project Coordinator',
    'Constructed Matter, Inc.',
    'active'
  ),

  -- ── Ben Peck ───────────────────────────────────────────────────────────────
  (
    'ben@constructedmatter.com',
    'Ben', 'Peck', 'Ben Peck',
    'admin',
    'Project Manager',
    'Project Manager',
    'Constructed Matter, Inc.',
    'active'
  ),

  -- ── Angel Gutierrez ────────────────────────────────────────────────────────
  (
    'angel@constructedmatter.com',
    'Angel', 'Gutierrez', 'Angel Gutierrez',
    'admin',
    'Field Operations Coordinator',
    'Field Operations Coordinator',
    'Constructed Matter, Inc.',
    'active'
  )

ON CONFLICT (email) DO UPDATE SET
  first_name   = EXCLUDED.first_name,
  last_name    = EXCLUDED.last_name,
  display_name = EXCLUDED.display_name,
  role_slug    = EXCLUDED.role_slug,
  title        = EXCLUDED.title,
  job_title    = EXCLUDED.job_title,
  company_name = EXCLUDED.company_name,
  status       = 'active',
  updated_at   = NOW();

-- Verify all 6 records
SELECT id, email, display_name, role_slug, title, status, created_at
FROM staff_users
WHERE email IN (
  'jeremy@constructedmatter.com',
  'brandon@constructedmatter.com',
  'joe@constructedmatter.com',
  'yovana@constructedmatter.com',
  'ben@constructedmatter.com',
  'angel@constructedmatter.com'
)
ORDER BY created_at;
