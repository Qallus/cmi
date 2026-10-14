-- ============================================================
-- CMI WebApp - Punch Lists
-- Date: 2026-10-14
--
-- Purpose:
--   Checklists of items to be checked off, attached to exactly one
--   Pipeline deal, Pre-Con opportunity or Job. A record can have any
--   number of lists. Items can be assigned to a staff member (which
--   puts them in that person's Daily Brief) and lists can be made
--   visible (read-only) to the client in the Job client portal.
--
--   Lists stay on the record they were made on; they are not moved
--   automatically when a deal becomes Pre-Con or Pre-Con becomes a Job.
--
--   All tables are PRIVATE: only the service role (the Next.js app,
--   after its own role checks) reads or writes them.
-- ============================================================

CREATE TABLE IF NOT EXISTS punch_lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID REFERENCES deals(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,                      -- sanitized HTML
  client_visible  BOOLEAN NOT NULL DEFAULT false,
  template_id     UUID,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMPTZ,
  CONSTRAINT punch_lists_one_parent CHECK (num_nonnulls(deal_id, opportunity_id, job_id) = 1)
);

CREATE TABLE IF NOT EXISTS punch_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id           UUID NOT NULL REFERENCES punch_lists(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  notes             TEXT,                    -- sanitized HTML
  location          TEXT,                    -- room / area
  trade             TEXT,
  priority          TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to       UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  due_date          DATE,
  sort_order        INT NOT NULL DEFAULT 0,
  completed_at      TIMESTAMPTZ,
  completed_by      UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  completed_by_name TEXT,
  created_by        UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS punch_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  items       JSONB NOT NULL DEFAULT '[]'::JSONB,  -- [{ "title", "location"?, "trade"? }]
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_punch_lists_deal ON punch_lists(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punch_lists_opportunity ON punch_lists(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punch_lists_job ON punch_lists(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punch_items_list ON punch_items(list_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_assignee_open ON punch_items(assigned_to) WHERE completed_at IS NULL;

ALTER TABLE punch_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages punch lists" ON punch_lists;
CREATE POLICY "Service role manages punch lists" ON punch_lists FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages punch items" ON punch_items;
CREATE POLICY "Service role manages punch items" ON punch_items FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages punch templates" ON punch_templates;
CREATE POLICY "Service role manages punch templates" ON punch_templates FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Starter construction templates (Final Walkthrough, Pre-Drywall, Kitchen,
-- Bathroom, Exterior & Landscape, Closeout) live in code —
-- apps/cmi-next/lib/punch/templates.ts — so they ship with the app and can't be
-- deleted. punch_templates holds only the templates staff save themselves;
-- is_system is reserved for future use.
