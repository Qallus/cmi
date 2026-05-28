-- CMI booking / appointment system, adapted from the Control P booking model.
-- Safe to run after the user management and project schedule migrations.

CREATE TABLE IF NOT EXISTS booking_appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 15,
  min_notice_minutes INTEGER NOT NULL DEFAULT 120,
  max_days_in_advance INTEGER NOT NULL DEFAULT 60,
  location_type TEXT NOT NULL DEFAULT 'phone_call'
    CHECK (location_type IN ('phone_call','video_meeting','in_person','onsite','inspection','delivery','custom_location')),
  meeting_url TEXT,
  color TEXT NOT NULL DEFAULT '#a87328',
  client_visible BOOLEAN NOT NULL DEFAULT true,
  creates_project_schedule_item BOOLEAN NOT NULL DEFAULT false,
  default_schedule_type TEXT NOT NULL DEFAULT 'milestone'
    CHECK (default_schedule_type IN ('task','milestone')),
  default_phase TEXT,
  default_priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (default_priority IN ('low','normal','high','urgent','critical','blocking_closeout')),
  display_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id UUID REFERENCES booking_appointment_types(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_schedule_item_id UUID REFERENCES project_schedule_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  company_name TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Phoenix',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','rescheduled','canceled','completed','no_show','follow_up_needed','awaiting_client','awaiting_staff','awaiting_project_info')),
  location_type TEXT NOT NULL DEFAULT 'phone_call',
  location TEXT,
  meeting_url TEXT,
  project_name TEXT,
  customer_notes TEXT,
  internal_notes TEXT,
  cancellation_reason TEXT,
  client_visible BOOLEAN NOT NULL DEFAULT true,
  show_on_project_manager BOOLEAN NOT NULL DEFAULT false,
  create_or_link_user BOOLEAN NOT NULL DEFAULT false,
  email_consent BOOLEAN NOT NULL DEFAULT true,
  sms_consent BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS booking_availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE,
  appointment_type_id UUID REFERENCES booking_appointment_types(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Phoenix',
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_blocked_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Blocked time',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Phoenix',
  reason TEXT,
  blocks_public_booking BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES booking_appointments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_type TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms','dashboard')),
  notification_type TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS booking_question_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id UUID REFERENCES booking_appointment_types(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','textarea','select','checkbox','number')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(appointment_type_id, field_key)
);

CREATE TABLE IF NOT EXISTS booking_question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES booking_appointments(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_appointments_start ON booking_appointments(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_status ON booking_appointments(status);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_contact ON booking_appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_project ON booking_appointments(project_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_status ON booking_notifications(status, created_at);

ALTER TABLE booking_appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_question_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_question_answers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'booking_appointment_types',
    'booking_appointments',
    'booking_availability_rules',
    'booking_blocked_times',
    'booking_notifications',
    'booking_question_fields',
    'booking_question_answers'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

INSERT INTO booking_appointment_types (
  name, slug, description, duration_minutes, buffer_after_minutes, min_notice_minutes,
  max_days_in_advance, location_type, color, client_visible, creates_project_schedule_item,
  default_schedule_type, default_phase, default_priority, display_order
)
VALUES
  ('Discovery Call','discovery-call','Initial call for new project fit, scope, budget, and next steps.',30,15,120,45,'phone_call','#a87328',true,false,'milestone','Discovery / Consultation','normal',10),
  ('Site Consultation','site-consultation','On-site walkthrough to review existing conditions and project goals.',60,30,240,60,'onsite','#b7833a',true,true,'milestone','Site Visit','high',20),
  ('Design Consultation','design-consultation','Design, selections, layout, and planning review.',60,15,240,60,'video_meeting','#8f6a3f',true,true,'task','Design / Planning','normal',30),
  ('Estimate / Scope Review','estimate-scope-review','Review estimate details, scope, inclusions, exclusions, and timeline.',45,15,240,60,'video_meeting','#9a7338',true,true,'milestone','Estimate / Proposal','high',40),
  ('Client Project Update','client-project-update','Client-visible project meeting for schedule status and milestone updates.',30,15,120,45,'video_meeting','#a87328',true,true,'milestone','Client Communication','normal',50),
  ('Subcontractor Site Walk','subcontractor-site-walk','Trade-specific site coordination meeting for assigned work.',60,15,240,45,'onsite','#7d684d',false,true,'task','Field Coordination','normal',60),
  ('Vendor Delivery / Procurement','vendor-delivery-procurement','Vendor delivery, procurement, or material coordination appointment.',60,15,240,45,'delivery','#6f604e',false,true,'task','Procurement','normal',70),
  ('Inspection / Field Coordination','inspection-field-coordination','Inspection, correction, or field coordination appointment.',60,15,240,45,'inspection','#9b5f32',true,true,'milestone','Inspections','high',80),
  ('Final Walkthrough / Punch Review','final-walkthrough-punch-review','Client walkthrough, punch list review, and closeout alignment.',60,15,240,60,'onsite','#a87328',true,true,'milestone','Punch List','high',90),
  ('Warranty / Service Visit','warranty-service-visit','Warranty review, service visit, or follow-up after completion.',60,15,240,60,'onsite','#7d684d',true,true,'task','Warranty / Service','normal',100)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  buffer_after_minutes = EXCLUDED.buffer_after_minutes,
  min_notice_minutes = EXCLUDED.min_notice_minutes,
  max_days_in_advance = EXCLUDED.max_days_in_advance,
  location_type = EXCLUDED.location_type,
  color = EXCLUDED.color,
  client_visible = EXCLUDED.client_visible,
  creates_project_schedule_item = EXCLUDED.creates_project_schedule_item,
  default_schedule_type = EXCLUDED.default_schedule_type,
  default_phase = EXCLUDED.default_phase,
  default_priority = EXCLUDED.default_priority,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = NOW();

INSERT INTO booking_availability_rules (day_of_week, start_time, end_time, timezone, is_available)
SELECT day, '09:00'::time, '16:00'::time, 'America/Phoenix', true
FROM generate_series(1, 5) AS day
WHERE NOT EXISTS (SELECT 1 FROM booking_availability_rules);
