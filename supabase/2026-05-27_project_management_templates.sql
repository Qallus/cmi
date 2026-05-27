-- Construction project template library and project management tables.
-- Safe to run after the existing project_schedule_items migrations.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'project_schedule_items'
      AND constraint_name = 'project_schedule_items_status_check'
  ) THEN
    ALTER TABLE project_schedule_items DROP CONSTRAINT project_schedule_items_status_check;
  END IF;
END $$;

ALTER TABLE project_schedule_items
  ADD CONSTRAINT project_schedule_items_status_check
  CHECK (status IN ('pending','scheduled','in_progress','waiting','delayed','blocked','needs_approval','complete','canceled'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'project_schedule_items'
      AND constraint_name = 'project_schedule_items_priority_check'
  ) THEN
    ALTER TABLE project_schedule_items DROP CONSTRAINT project_schedule_items_priority_check;
  END IF;
END $$;

ALTER TABLE project_schedule_items
  ADD CONSTRAINT project_schedule_items_priority_check
  CHECK (priority IN ('low','normal','high','urgent','critical','blocking_closeout'));

CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  suggested_duration_days INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_template_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, phase_key)
);

CREATE TABLE IF NOT EXISTS project_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  task_key TEXT NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  offset_days INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 1440,
  dependency_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  suggested_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  client_visible BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','critical','blocking_closeout')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, task_key)
);

CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES project_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phase_key TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  sort_order INTEGER NOT NULL DEFAULT 0,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  template_task_id UUID REFERENCES project_template_tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('pending','scheduled','in_progress','waiting','delayed','blocked','needs_approval','complete','canceled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','critical','blocking_closeout')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 1440,
  visible_on_gantt BOOLEAN NOT NULL DEFAULT true,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  assigned_staff_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  assigned_vendor_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  predecessor_task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  dependent_task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
    CHECK (dependency_type IN ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  lag_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(predecessor_task_id, dependent_task_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE CASCADE,
  task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  assignee_id UUID,
  assignee_type TEXT NOT NULL DEFAULT 'staff' CHECK (assignee_type IN ('staff','client','subcontractor','vendor','other')),
  role TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID,
  event_type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  actor_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'dashboard' CHECK (channel IN ('dashboard','email','sms')),
  recipient_id TEXT,
  recipient_type TEXT,
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_templates_slug ON project_templates(slug);
CREATE INDEX IF NOT EXISTS idx_project_template_tasks_template ON project_template_tasks(template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_phases_project ON project_phases(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_tasks_dates ON project_tasks(start_at, end_at, due_at);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_task_dependencies_project ON project_task_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_logs_project ON project_activity_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_notifications_status ON project_notifications(status, created_at);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_template_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'project_templates',
    'project_template_phases',
    'project_template_tasks',
    'project_phases',
    'project_tasks',
    'project_task_dependencies',
    'project_assignments',
    'project_activity_logs',
    'project_notifications'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

INSERT INTO project_templates (name, slug, description, category, suggested_duration_days, is_active)
VALUES
  ('Kitchen Remodel','kitchen-remodel','Kitchen remodel schedule covering design, procurement, demo, rough-ins, cabinetry, countertops, finishes, and closeout.','Residential Remodel',70,true),
  ('Bathroom Remodel','bathroom-remodel','Bathroom remodel schedule covering demo, plumbing, electrical, waterproofing, tile, fixtures, glass, and closeout.','Residential Remodel',49,true),
  ('Bedroom Remodel','bedroom-remodel','Bedroom remodel schedule for finish updates, lighting, flooring, closet work, paint, and closeout.','Residential Remodel',35,true),
  ('Garage Remodel / Conversion','garage-remodel-conversion','Garage remodel or conversion schedule for storage, electrical, insulation, HVAC, flooring, finishes, and closeout.','Residential Remodel',63,true),
  ('Casita / Guest House / ADU','casita-guest-house-adu','ADU schedule covering design, engineering, permitting, site work, utilities, shell, interiors, inspections, and closeout.','Residential New Build',210,true),
  ('Home Addition / Bedroom Extension','home-addition-bedroom-extension','Home addition schedule covering design, engineering, permitting, foundation, framing, MEP, finishes, and closeout.','Residential Addition',180,true),
  ('New Custom Home','new-custom-home','New custom home schedule from design and permitting through foundation, shell, MEP, finishes, inspections, and closeout.','Residential New Build',365,true),
  ('Backyard Remodel / Outdoor Living','backyard-remodel-outdoor-living','Outdoor living schedule for hardscape, outdoor kitchens, utilities, lighting, turf, planting, and closeout.','Landscape / Outdoor Living',70,true),
  ('Front Yard / New Landscape','front-yard-new-landscape','Landscape schedule covering design, HOA or permit review, demolition, grading, irrigation, lighting, planting, turf, and closeout.','Landscape / Outdoor Living',56,true),
  ('Whole Home Remodel','whole-home-remodel','Large whole-home remodel schedule involving design, phased demo, MEP updates, finishes, inspections, and closeout.','Residential Remodel',240,true),
  ('Commercial Tenant Improvement','commercial-tenant-improvement','Commercial tenant improvement schedule for permits, demo, framing, MEP, inspections, finishes, and closeout.','Commercial',150,true),
  ('Exterior Remodel','exterior-remodel','Exterior remodel schedule for siding, stucco, paint, windows, doors, roofing tie-ins, and outdoor finish upgrades.','Exterior',56,true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  suggested_duration_days = EXCLUDED.suggested_duration_days,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO project_template_tasks (template_id, phase_name, task_key, task_name, description, offset_days, duration_minutes, dependency_keys, suggested_roles, client_visible, priority, sort_order)
SELECT pt.id, seed.phase_name, seed.task_key, seed.task_name, seed.description, seed.offset_days, seed.duration_minutes,
       seed.dependency_keys, seed.suggested_roles, seed.client_visible, seed.priority, seed.sort_order
FROM project_templates pt
JOIN (
  VALUES
    ('all','intake','Project Intake','Client intake completed','Start project record and confirm core client/project details.',0,1440,ARRAY[]::TEXT[],ARRAY['Project Manager'],true,'normal',1),
    ('all','design','Design / Planning','Design, scope, selections, or construction planning','Develop the construction plan and align scope before field work.',1,10080,ARRAY['intake'],ARRAY['Designer','Project Manager'],true,'normal',2),
    ('all','estimate','Estimate / Proposal','Estimate and scope review','Confirm budget, scope, exclusions, and project readiness.',8,7200,ARRAY['design'],ARRAY['Estimator'],true,'normal',3),
    ('all','contract','Contract / Deposit','Contract signed and deposit received','Finalize contract, deposit, and administrative setup.',13,1440,ARRAY['estimate'],ARRAY['Project Manager','Admin'],true,'high',4),
    ('all','permit','Permitting','Permit or HOA review if required','Submit, monitor, and confirm approvals before construction.',14,20160,ARRAY['contract'],ARRAY['Project Manager'],true,'high',5),
    ('all','precon','Pre-Construction','Pre-construction meeting','Align staff, vendors, access, safety, communication, and logistics.',15,1440,ARRAY['contract'],ARRAY['Project Manager','Field Lead'],true,'normal',6),
    ('all','demo','Demolition','Site protection and demolition','Protect the site and complete required demolition or preparation.',16,4320,ARRAY['precon'],ARRAY['Demo Crew','Field Lead'],false,'normal',7),
    ('all','rough','Mechanical / Electrical / Plumbing','Rough-in or utility coordination','Coordinate trade rough-ins, utility routes, and required documentation.',20,7200,ARRAY['demo'],ARRAY['MEP Trades'],false,'normal',8),
    ('all','inspection','Inspections','Rough or required inspection','Schedule inspection, capture results, and resolve corrections.',25,4320,ARRAY['rough'],ARRAY['Project Manager','Inspector'],true,'high',9),
    ('all','finishes','Interior Finishes','Finish work','Complete finish installation, trim, fixtures, and detail work.',28,14400,ARRAY['inspection'],ARRAY['Finish Trades'],false,'normal',10),
    ('all','quality','Quality Control','Final quality control','Review workmanship, documentation, photos, and closeout readiness.',38,1440,ARRAY['finishes'],ARRAY['Project Manager'],false,'normal',11),
    ('all','punch','Punch List','Punch list corrections','Complete open corrections and document completion.',39,4320,ARRAY['quality'],ARRAY['Field Lead'],true,'high',12),
    ('all','walkthrough','Client Walkthrough','Client walkthrough','Walk the project with the client and capture approval items.',42,1440,ARRAY['punch'],ARRAY['Project Manager','Client'],true,'high',13),
    ('all','closeout','Closeout','Final payment and closeout package','Send closeout documents, warranty notes, final invoice, and archive records.',43,1440,ARRAY['walkthrough'],ARRAY['Admin','Project Manager'],true,'normal',14)
) AS seed(template_scope, task_key, phase_name, task_name, description, offset_days, duration_minutes, dependency_keys, suggested_roles, client_visible, priority, sort_order)
  ON seed.template_scope = 'all'
ON CONFLICT (template_id, task_key) DO UPDATE SET
  phase_name = EXCLUDED.phase_name,
  task_name = EXCLUDED.task_name,
  description = EXCLUDED.description,
  offset_days = EXCLUDED.offset_days,
  duration_minutes = EXCLUDED.duration_minutes,
  dependency_keys = EXCLUDED.dependency_keys,
  suggested_roles = EXCLUDED.suggested_roles,
  client_visible = EXCLUDED.client_visible,
  priority = EXCLUDED.priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO project_template_phases (template_id, name, phase_key, sort_order)
SELECT DISTINCT template_id, phase_name, lower(regexp_replace(phase_name, '[^a-zA-Z0-9]+', '-', 'g')), MIN(sort_order)
FROM project_template_tasks
GROUP BY template_id, phase_name
ON CONFLICT (template_id, phase_key) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
