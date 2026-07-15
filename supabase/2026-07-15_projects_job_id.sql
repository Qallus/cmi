-- Job → Project relationship (Phase 2 backbone). A project can be standalone
-- (job_id null) or linked to a job. Tasks stay under projects via
-- project_schedule_items.project_id; the embedded job Project Manager scopes its
-- board by board_id = job.id.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_job_id_idx ON public.projects (job_id);
