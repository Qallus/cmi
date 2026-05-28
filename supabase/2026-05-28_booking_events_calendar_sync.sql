-- Booking one-time event pages and staff calendar sync foundation.
-- Run after 2026-05-28_booking_system_phase1.sql.

CREATE TABLE IF NOT EXISTS booking_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google','outlook','apple_ical','caldav','manual')),
  provider_account_email TEXT,
  calendar_id TEXT,
  calendar_name TEXT,
  sync_direction TEXT NOT NULL DEFAULT 'two_way'
    CHECK (sync_direction IN ('one_way_in','one_way_out','two_way','three_way')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','connected','paused','error','revoked')),
  access_token_secret_ref TEXT,
  refresh_token_secret_ref TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_event_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id UUID REFERENCES booking_appointment_types(id) ON DELETE SET NULL,
  host_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_schedule_item_id UUID REFERENCES project_schedule_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Phoenix',
  location_type TEXT NOT NULL DEFAULT 'in_person'
    CHECK (location_type IN ('phone_call','video_meeting','in_person','onsite','inspection','delivery','custom_location')),
  location TEXT,
  meeting_url TEXT,
  capacity INTEGER,
  registration_count INTEGER NOT NULL DEFAULT 0,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  client_visible BOOLEAN NOT NULL DEFAULT true,
  show_on_project_manager BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','private','archived','canceled')),
  seo_title TEXT,
  seo_description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS booking_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_page_id UUID REFERENCES booking_event_pages(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES booking_appointments(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','pending_approval','approved','waitlisted','canceled','attended','no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_calendar_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES booking_calendar_connections(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES booking_appointments(id) ON DELETE CASCADE,
  event_page_id UUID REFERENCES booking_event_pages(id) ON DELETE CASCADE,
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  provider TEXT,
  provider_event_id TEXT,
  sync_direction TEXT,
  sync_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (sync_status IN ('queued','synced','failed','skipped','conflict')),
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

ALTER TABLE booking_appointments
  ADD COLUMN IF NOT EXISTS event_page_id UUID REFERENCES booking_event_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_sync_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (calendar_sync_status IN ('queued','synced','failed','skipped','conflict')),
  ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_booking_calendar_connections_staff ON booking_calendar_connections(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_booking_event_pages_slug ON booking_event_pages(slug);
CREATE INDEX IF NOT EXISTS idx_booking_event_pages_start ON booking_event_pages(start_time);
CREATE INDEX IF NOT EXISTS idx_booking_event_registrations_event ON booking_event_registrations(event_page_id);
CREATE INDEX IF NOT EXISTS idx_booking_calendar_sync_events_status ON booking_calendar_sync_events(sync_status, created_at);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_event_page ON booking_appointments(event_page_id);

ALTER TABLE booking_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_event_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_calendar_sync_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'booking_calendar_connections',
    'booking_event_pages',
    'booking_event_registrations',
    'booking_calendar_sync_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
