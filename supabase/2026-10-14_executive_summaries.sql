-- ============================================================
-- CMI WebApp - Executive Summaries
-- Date: 2026-10-14
--
-- Purpose:
--   Bolt-written, CMI-branded executive summaries of a Job or Pre-Con
--   opportunity, for the team (everything, incl. budget and risks) or
--   the client (client-safe content only). Each generated summary is
--   kept, with who it was sent to and whether it was posted to the
--   client portal.
--
--   PRIVATE: only the service role (the Next.js app, after its own
--   role checks) reads or writes it.
-- ============================================================

CREATE TABLE IF NOT EXISTS executive_summaries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID REFERENCES jobs(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  audience       TEXT NOT NULL CHECK (audience IN ('team','client')),
  headline       TEXT NOT NULL,
  body_html      TEXT NOT NULL,             -- sanitized HTML
  facts          JSONB NOT NULL DEFAULT '[]'::JSONB,  -- [{ "label", "value" }]
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  sent_to        JSONB NOT NULL DEFAULT '[]'::JSONB,  -- [{ "name", "email", "kind" }]
  posted_to_portal BOOLEAN NOT NULL DEFAULT false,
  created_by     UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at        TIMESTAMPTZ,
  CONSTRAINT executive_summaries_one_parent CHECK (num_nonnulls(job_id, opportunity_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_exec_summaries_job ON executive_summaries(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exec_summaries_opp ON executive_summaries(opportunity_id) WHERE opportunity_id IS NOT NULL;

ALTER TABLE executive_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages executive summaries" ON executive_summaries;
CREATE POLICY "Service role manages executive summaries" ON executive_summaries FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
