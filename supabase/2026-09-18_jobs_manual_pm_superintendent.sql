-- Jobs: manual (non-staff) Project Manager / Superintendent names.
-- The Job Summary "Add manually" flow and Bolt already read/write these
-- (lib/jobs/types.ts), but the columns were never created, so those saves
-- failed. Staff assignments stay in job_internal_users (role = 'Project
-- Manager' | 'Superintendent'); these hold free-text fallbacks only.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS project_manager TEXT,
  ADD COLUMN IF NOT EXISTS superintendent TEXT;
