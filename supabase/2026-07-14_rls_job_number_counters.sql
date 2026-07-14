-- Fixes Supabase security advisor `rls_disabled_in_public` on public.job_number_counters.
--
-- job_number_counters is internal bookkeeping (the per-year YY_###_ sequence). It was
-- created in 2026-07-08_jobs_feature.sql without RLS, leaving it readable/writable by
-- anyone holding the anon key. Nothing should touch it directly: the only writer is the
-- assign_job_number() trigger on jobs.
--
-- assign_job_number() becomes SECURITY DEFINER (owner: postgres, same owner as the table)
-- so the counter still increments regardless of which role inserts the job. search_path is
-- pinned, which is required for a SECURITY DEFINER function. RLS is then enabled with zero
-- policies -- service_role and the table owner bypass RLS, anon/authenticated get nothing.

CREATE OR REPLACE FUNCTION public.assign_job_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  yr    INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  yy    TEXT    := to_char(NOW(), 'YY');
  seq   INTEGER;
BEGIN
  IF NEW.is_template THEN
    RETURN NEW;  -- templates don't consume job numbers
  END IF;
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    INSERT INTO job_number_counters (year, last_seq)
      VALUES (yr, 1)
      ON CONFLICT (year) DO UPDATE SET last_seq = job_number_counters.last_seq + 1
      RETURNING last_seq INTO seq;
    NEW.job_number := yy || '_' || lpad(seq::text, 3, '0') || '_' || NEW.job_name;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.job_number_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.job_number_counters FROM anon, authenticated;
