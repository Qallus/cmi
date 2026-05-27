-- Optional Scheduled Items grouping fields for the CMI Gantt Project Manager.
-- The dashboard mirrors these values in metadata for backward compatibility.

ALTER TABLE project_schedule_items
  ADD COLUMN IF NOT EXISTS visible_on_gantt BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS schedule_group_key TEXT,
  ADD COLUMN IF NOT EXISTS template_slug TEXT,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

CREATE INDEX IF NOT EXISTS idx_project_schedule_items_visible_on_gantt
  ON project_schedule_items(visible_on_gantt);

CREATE INDEX IF NOT EXISTS idx_project_schedule_items_schedule_group
  ON project_schedule_items(schedule_group_key);

CREATE INDEX IF NOT EXISTS idx_project_schedule_items_template_slug
  ON project_schedule_items(template_slug);
