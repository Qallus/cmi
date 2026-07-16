-- Unified job notes stream (Jobs Phase 2). Internal notes tied to a job, with
-- pinning. Service-role only (RLS on, no policies — the app authorizes).
CREATE TABLE IF NOT EXISTS public.job_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  author_staff_id uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  author_name     text,
  body            text NOT NULL,
  pinned          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_notes_job_idx ON public.job_notes (job_id, created_at DESC);
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_notes FROM anon, authenticated;
