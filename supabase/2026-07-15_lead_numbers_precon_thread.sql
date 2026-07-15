-- Pre-construction lead number threading lead → opportunity → job.
-- Leads (quotes) get CM-YYYY-#### from the SAME sequence opportunities use, so a
-- lead and the opportunity it becomes carry one continuous, non-colliding number.
-- Thread: quotes.lead_number → pipeline_opportunities.job_number → jobs.lead_number
-- (the job also keeps its own YY_###_JobName for project management).
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS lead_number text;
ALTER TABLE public.jobs   ADD COLUMN IF NOT EXISTS lead_number text;

CREATE OR REPLACE FUNCTION public.assign_lead_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.lead_number IS NULL OR NEW.lead_number = '' THEN
    NEW.lead_number := 'CM-' || to_char(NOW(), 'YYYY') || '-' ||
                       lpad(nextval('pipeline_job_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_quotes_lead_number ON public.quotes;
CREATE TRIGGER trg_quotes_lead_number BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.assign_lead_number();

-- Backfill: reuse the linked opportunity's number where a lead already converted,
-- so existing threads stay consistent; remaining leads get a fresh number.
UPDATE public.quotes q SET lead_number = o.job_number
  FROM public.pipeline_opportunities o
  WHERE o.linked_quote_id = q.id AND q.lead_number IS NULL AND o.job_number IS NOT NULL;
UPDATE public.quotes SET lead_number = 'CM-' || to_char(created_at, 'YYYY') || '-' ||
  lpad(nextval('pipeline_job_number_seq')::text, 4, '0')
  WHERE lead_number IS NULL;

-- Backfill jobs.lead_number from their originating opportunity.
UPDATE public.jobs j SET lead_number = o.job_number
  FROM public.pipeline_opportunities o
  WHERE j.related_opportunity_id = o.id AND j.lead_number IS NULL AND o.job_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_lead_number_key ON public.quotes (lead_number);
