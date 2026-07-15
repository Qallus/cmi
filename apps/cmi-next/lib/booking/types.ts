export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "rescheduled"
  | "canceled"
  | "completed"
  | "no_show"
  | "follow_up_needed"
  | "awaiting_client"
  | "awaiting_staff"
  | "awaiting_project_info";

export type AppointmentType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_in_advance: number;
  location_type: string;
  meeting_url: string | null;
  color: string | null;
  client_visible: boolean;
  creates_project_schedule_item: boolean;
  default_schedule_type: "task" | "milestone";
  default_phase: string | null;
  default_priority: string;
  display_order: number;
  is_active: boolean;
};

export type BookingAppointment = {
  id: string;
  appointment_type_id: string | null;
  contact_id: string | null;
  staff_user_id: string | null;
  assigned_staff_user_id: string | null;
  project_id: string | null;
  project_schedule_item_id: string | null;
  event_page_id?: string | null;
  title: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  company_name: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  status: AppointmentStatus;
  location_type: string;
  location: string | null;
  meeting_url: string | null;
  project_name: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  cancellation_reason: string | null;
  client_visible: boolean;
  show_on_project_manager: boolean;
  create_or_link_user: boolean;
  email_consent: boolean;
  sms_consent: boolean;
  calendar_sync_status?: "queued" | "synced" | "failed" | "skipped" | "conflict";
  calendar_synced_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AvailabilityRule = {
  id: string;
  staff_user_id: string | null;
  appointment_type_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_available: boolean;
};

export type BlockedTime = {
  id: string;
  staff_user_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  timezone: string;
  reason: string | null;
  blocks_public_booking: boolean;
};

export type BookingNotification = {
  id: string;
  appointment_id: string | null;
  channel: "email" | "sms" | "dashboard";
  notification_type: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  subject: string | null;
  body: string | null;
  created_at: string;
};

export type BookingContactOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string | null;
};

export type BookingUserOption = {
  id: string;
  display_name: string;
  email: string;
  role_slug: string;
  status: string;
};

export type BookingProjectOption = {
  id: string;
  title: string;
  status: string | null;
  client_name: string | null;
};

export type BookingCalendarConnection = {
  id: string;
  staff_user_id: string | null;
  provider: "google" | "outlook" | "apple_ical" | "caldav" | "manual";
  provider_account_email: string | null;
  calendar_id: string | null;
  calendar_name: string | null;
  sync_direction: "one_way_in" | "one_way_out" | "two_way" | "three_way";
  status: "pending" | "connected" | "paused" | "error" | "revoked";
  last_synced_at: string | null;
  sync_error: string | null;
};

export type BookingEventPage = {
  id: string;
  appointment_type_id: string | null;
  host_staff_user_id: string | null;
  project_id: string | null;
  project_schedule_item_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  location_type: string;
  location: string | null;
  meeting_url: string | null;
  capacity: number | null;
  registration_count: number;
  requires_approval: boolean;
  client_visible: boolean;
  show_on_project_manager: boolean;
  status: "draft" | "published" | "private" | "archived" | "canceled";
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  metadata?: Record<string, unknown> | null;
};

export type BookingData = {
  appointmentTypes: AppointmentType[];
  appointments: BookingAppointment[];
  availabilityRules: AvailabilityRule[];
  blockedTimes: BlockedTime[];
  notifications: BookingNotification[];
  contacts: BookingContactOption[];
  users: BookingUserOption[];
  projects: BookingProjectOption[];
  eventPages: BookingEventPage[];
  calendarConnections: BookingCalendarConnection[];
};

export type BookingSlot = {
  start: string;
  end: string;
  label: string;
};

export type BookingInput = {
  appointment_type_id: string;
  start_time: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  project_name?: string;
  project_id?: string;
  assigned_staff_user_id?: string;
  notes?: string;
  sms_consent?: boolean;
  email_consent?: boolean;
  create_or_link_user?: boolean;
  show_on_project_manager?: boolean;
  event_page_id?: string;
  source?: "public" | "dashboard";
};

export type EventPageInput = {
  title: string;
  slug?: string;
  summary?: string;
  description?: string;
  appointment_type_id?: string;
  host_staff_user_id?: string;
  project_id?: string;
  start_time: string;
  end_time: string;
  location_type?: string;
  location?: string;
  meeting_url?: string;
  capacity?: number;
  requires_approval?: boolean;
  client_visible?: boolean;
  show_on_project_manager?: boolean;
  status?: "draft" | "published" | "private";
  event_type?: string;
  photo_url?: string;
  video_url?: string;
  gallery_urls?: string[];
};
