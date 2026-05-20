-- Optional Phase 1 Project Management fields for project_schedule_items.
-- The dashboard currently stores these values in metadata for backward compatibility.
-- Run this when you want first-class columns for reporting, filtering, and indexing.

ALTER TABLE project_schedule_items
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','critical','blocking_closeout')),
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocker_reason TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_project_schedule_items_priority ON project_schedule_items(priority);
CREATE INDEX IF NOT EXISTS idx_project_schedule_items_client_visible ON project_schedule_items(client_visible);
CREATE INDEX IF NOT EXISTS idx_project_schedule_items_blocked ON project_schedule_items(is_blocked);
CREATE INDEX IF NOT EXISTS idx_project_schedule_items_sort ON project_schedule_items(board_id, phase, sort_order);
