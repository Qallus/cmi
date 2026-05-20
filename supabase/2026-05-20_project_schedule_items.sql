-- Project Gantt / schedule manager items for the staff dashboard.
-- Stores project-aligned tasks, phases, dependencies, participants, status, and progress.

CREATE TABLE IF NOT EXISTS project_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id TEXT,
  fluent_task_id TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  -- Kept nullable because some CMI Supabase environments do not have client_projects yet.
  client_project_id UUID,
  type TEXT NOT NULL DEFAULT 'task' CHECK (type IN ('project', 'phase', 'task', 'milestone')),
  project_title TEXT,
  title TEXT NOT NULL,
  phase TEXT,
  assignee TEXT,
  client TEXT,
  participants TEXT,
  dependencies TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'delayed', 'blocked', 'complete')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  notify BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  forms TEXT,
  punch TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_schedule_items_board ON project_schedule_items(board_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_items_project ON project_schedule_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_items_client_project ON project_schedule_items(client_project_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_items_dates ON project_schedule_items(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_project_schedule_items_status ON project_schedule_items(status);

ALTER TABLE project_schedule_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_schedule_items_authenticated_all" ON project_schedule_items;
CREATE POLICY "project_schedule_items_authenticated_all"
  ON project_schedule_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
