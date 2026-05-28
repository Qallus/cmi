import type { BookingData } from "./types";

const now = new Date();
const tomorrow = new Date(now);
tomorrow.setDate(now.getDate() + 1);
tomorrow.setHours(16, 0, 0, 0);
const end = new Date(tomorrow.getTime() + 60 * 60 * 1000);
const today = new Date().toISOString();

export const demoAppointmentTypes = [
  {
    id: "81000000-0000-4000-8000-000000000001",
    name: "Discovery Call",
    slug: "discovery-call",
    description: "Initial call for project fit, scope, budget, and next steps.",
    duration_minutes: 30,
    buffer_before_minutes: 0,
    buffer_after_minutes: 15,
    min_notice_minutes: 0,
    max_days_in_advance: 60,
    location_type: "phone_call",
    meeting_url: null,
    color: "#a87328",
    client_visible: true,
    creates_project_schedule_item: false,
    default_schedule_type: "milestone" as const,
    default_phase: "Discovery / Consultation",
    default_priority: "normal",
    display_order: 10,
    is_active: true
  },
  {
    id: "81000000-0000-4000-8000-000000000002",
    name: "Site Consultation",
    slug: "site-consultation",
    description: "On-site walkthrough to review existing conditions and project goals.",
    duration_minutes: 60,
    buffer_before_minutes: 0,
    buffer_after_minutes: 30,
    min_notice_minutes: 0,
    max_days_in_advance: 60,
    location_type: "onsite",
    meeting_url: null,
    color: "#b7833a",
    client_visible: true,
    creates_project_schedule_item: true,
    default_schedule_type: "milestone" as const,
    default_phase: "Site Visit",
    default_priority: "high",
    display_order: 20,
    is_active: true
  },
  {
    id: "81000000-0000-4000-8000-000000000003",
    name: "Client Project Update",
    slug: "client-project-update",
    description: "Client-visible project meeting for schedule status and milestone updates.",
    duration_minutes: 30,
    buffer_before_minutes: 0,
    buffer_after_minutes: 15,
    min_notice_minutes: 0,
    max_days_in_advance: 45,
    location_type: "video_meeting",
    meeting_url: null,
    color: "#a87328",
    client_visible: true,
    creates_project_schedule_item: true,
    default_schedule_type: "milestone" as const,
    default_phase: "Client Communication",
    default_priority: "normal",
    display_order: 50,
    is_active: true
  }
];

export function getDemoBookingData(): BookingData {
  return {
    appointmentTypes: demoAppointmentTypes,
    appointments: [
      {
        id: "82000000-0000-4000-8000-000000000001",
        appointment_type_id: demoAppointmentTypes[1].id,
        contact_id: "60000000-0000-4000-8000-000000000001",
        staff_user_id: "50000000-0000-4000-8000-000000000003",
        assigned_staff_user_id: "50000000-0000-4000-8000-000000000002",
        project_id: null,
        project_schedule_item_id: null,
        title: "Site Consultation: Dana Reyes",
        customer_first_name: "Dana",
        customer_last_name: "Reyes",
        customer_email: "client@example.com",
        customer_phone: "4805551212",
        company_name: "Scottsdale Master Bath",
        start_time: tomorrow.toISOString(),
        end_time: end.toISOString(),
        timezone: "America/Phoenix",
        status: "confirmed",
        location_type: "onsite",
        location: "Scottsdale, AZ",
        meeting_url: null,
        project_name: "Scottsdale Master Bath",
        customer_notes: "Review bathroom remodel scope and access.",
        internal_notes: "Demo appointment linked to client and project context.",
        cancellation_reason: null,
        client_visible: true,
        show_on_project_manager: true,
        create_or_link_user: true,
        email_consent: true,
        sms_consent: true,
        created_at: today,
        updated_at: today
      }
    ],
    availabilityRules: [1, 2, 3, 4, 5].map(day => ({
      id: `83000000-0000-4000-8000-00000000000${day}`,
      staff_user_id: null,
      appointment_type_id: null,
      day_of_week: day,
      start_time: "09:00",
      end_time: "16:00",
      timezone: "America/Phoenix",
      is_available: true
    })),
    blockedTimes: [],
    notifications: [],
    contacts: [
      { id: "60000000-0000-4000-8000-000000000001", name: "Dana Reyes", email: "client@example.com", phone: "4805551212", type: "Client" }
    ],
    users: [
      { id: "50000000-0000-4000-8000-000000000002", display_name: "Ben Peck", email: "ben@constructedmatter.com", role_slug: "project_manager", status: "invited" },
      { id: "50000000-0000-4000-8000-000000000003", display_name: "Dana Reyes", email: "client@example.com", role_slug: "client", status: "pending" }
    ],
    projects: [
      { id: "90000000-0000-4000-8000-000000000001", title: "Scottsdale Master Bath", status: "scheduled", client_name: "Dana Reyes" }
    ],
    eventPages: [
      {
        id: "84000000-0000-4000-8000-000000000001",
        appointment_type_id: demoAppointmentTypes[1].id,
        host_staff_user_id: "50000000-0000-4000-8000-000000000002",
        project_id: null,
        project_schedule_item_id: null,
        title: "Arcadia Remodel Open Consultation",
        slug: "arcadia-remodel-open-consultation",
        summary: "One-time consultation block for remodel planning.",
        description: "Meet with the CMI team to review remodel scope, schedule expectations, and project fit.",
        start_time: tomorrow.toISOString(),
        end_time: end.toISOString(),
        timezone: "America/Phoenix",
        location_type: "onsite",
        location: "Phoenix, AZ",
        meeting_url: null,
        capacity: 8,
        registration_count: 1,
        requires_approval: false,
        client_visible: true,
        show_on_project_manager: true,
        status: "published",
        seo_title: null,
        seo_description: null,
        published_at: today
      }
    ],
    calendarConnections: [
      {
        id: "85000000-0000-4000-8000-000000000001",
        staff_user_id: "50000000-0000-4000-8000-000000000002",
        provider: "google",
        provider_account_email: "ben@constructedmatter.com",
        calendar_id: "primary",
        calendar_name: "Ben Peck",
        sync_direction: "two_way",
        status: "pending",
        last_synced_at: null,
        sync_error: null
      }
    ]
  };
}
