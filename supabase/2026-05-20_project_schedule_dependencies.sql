-- Project Gantt dependency links.
-- Supports Buildertrend-style visual connectors between schedule items.

CREATE TABLE IF NOT EXISTS project_schedule_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_project_id UUID,
  source_item_id UUID NOT NULL REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  target_item_id UUID NOT NULL REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
    CHECK (dependency_type IN ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  lag_days INTEGER NOT NULL DEFAULT 0,
  auto_shift BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_schedule_dependencies_unique_pair UNIQUE (source_item_id, target_item_id, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_project_schedule_dependencies_board ON project_schedule_dependencies(board_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_dependencies_source ON project_schedule_dependencies(source_item_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_dependencies_target ON project_schedule_dependencies(target_item_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_dependencies_project ON project_schedule_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_dependencies_client_project ON project_schedule_dependencies(client_project_id);

ALTER TABLE project_schedule_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_schedule_dependencies_authenticated_all" ON project_schedule_dependencies;
CREATE POLICY "project_schedule_dependencies_authenticated_all"
  ON project_schedule_dependencies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
