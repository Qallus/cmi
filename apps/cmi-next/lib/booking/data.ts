import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToAllSubscribers } from "@/lib/push/web-push";
import { buildAvailabilitySlots, cleanText, dateTimeToDateKey, formatPhoenixDateTime, makeBookingTitle, normalizePhone, parseDateKey } from "./availability";
import type { AppointmentStatus, AppointmentType, BookingAppointment, BookingData, BookingInput, BookingSlot, EventPageInput } from "./types";

const activeBusyStatuses = ["pending", "confirmed", "rescheduled", "awaiting_client", "awaiting_staff", "awaiting_project_info"];

export async function loadBookingData(): Promise<BookingData> {
  const supabase = getSupabaseAdmin();
  const [appointmentTypes, appointments, availabilityRules, blockedTimes, notifications, contacts, users, projects, eventPages, calendarConnections] = await Promise.all([
    supabase.from("booking_appointment_types").select("*").order("display_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("booking_appointments").select("*").order("start_time", { ascending: true }).limit(250),
    supabase.from("booking_availability_rules").select("*").order("day_of_week", { ascending: true }).order("start_time", { ascending: true }),
    supabase.from("booking_blocked_times").select("*").order("start_time", { ascending: false }).limit(100),
    supabase.from("booking_notifications").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("contacts").select("id, first_name, last_name, email, phone, type").order("last_name", { ascending: true }).limit(250),
    supabase.from("staff_users").select("id, display_name, email, role_slug, status").order("display_name", { ascending: true }).limit(250),
    supabase.from("projects").select("id, title, status").order("created_at", { ascending: false }).limit(150),
    supabase.from("booking_event_pages").select("*").order("start_time", { ascending: true }).limit(100),
    supabase.from("booking_calendar_connections").select("*").order("created_at", { ascending: false }).limit(100)
  ]);

  const error = appointmentTypes.error || appointments.error || availabilityRules.error || blockedTimes.error || notifications.error || contacts.error || users.error || projects.error || eventPages.error || calendarConnections.error;
  if (error) throw error;

  return {
    appointmentTypes: (appointmentTypes.data || []) as AppointmentType[],
    appointments: (appointments.data || []) as BookingAppointment[],
    availabilityRules: (availabilityRules.data || []) as BookingData["availabilityRules"],
    blockedTimes: (blockedTimes.data || []) as BookingData["blockedTimes"],
    notifications: (notifications.data || []) as BookingData["notifications"],
    contacts: (contacts.data || []).map(row => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || "Unnamed contact",
      email: row.email,
      phone: row.phone,
      type: row.type
    })),
    users: (users.data || []) as BookingData["users"],
    projects: (projects.data || []).map(row => ({
      id: row.id,
      title: row.title || "Untitled project",
      status: row.status,
      client_name: null
    })),
    eventPages: eventPages.data || [],
    calendarConnections: calendarConnections.data || []
  };
}

export async function loadAppointmentTypes() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("booking_appointment_types")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as AppointmentType[];
}

export async function loadAvailabilitySlots(appointmentTypeId: string, dateKey: string): Promise<BookingSlot[]> {
  const supabase = getSupabaseAdmin();
  const safeDateKey = parseDateKey(dateKey);
  if (!appointmentTypeId) throw new Error("Appointment type is required.");
  if (!safeDateKey) throw new Error("A valid date is required.");

  const typeResult = await supabase.from("booking_appointment_types").select("*").eq("id", appointmentTypeId).eq("is_active", true).maybeSingle();
  if (typeResult.error) throw typeResult.error;
  if (!typeResult.data) throw new Error("Appointment type was not found.");

  const rangeStart = new Date(`${safeDateKey}T00:00:00-07:00`);
  const rangeEnd = new Date(`${safeDateKey}T23:59:59-07:00`);
  const [rules, appointments, blockedTimes] = await Promise.all([
    supabase.from("booking_availability_rules").select("*").or(`appointment_type_id.is.null,appointment_type_id.eq.${appointmentTypeId}`).order("start_time", { ascending: true }),
    supabase.from("booking_appointments").select("start_time,end_time").in("status", activeBusyStatuses).lt("start_time", rangeEnd.toISOString()).gt("end_time", rangeStart.toISOString()),
    supabase.from("booking_blocked_times").select("start_time,end_time").eq("blocks_public_booking", true).lt("start_time", rangeEnd.toISOString()).gt("end_time", rangeStart.toISOString())
  ]);

  const error = rules.error || appointments.error || blockedTimes.error;
  if (error) throw error;

  return buildAvailabilitySlots({
    appointmentType: typeResult.data as AppointmentType,
    dateKey: safeDateKey,
    rules: rules.data || [],
    appointments: appointments.data || [],
    blockedTimes: blockedTimes.data || []
  });
}

function cleanBookingInput(input: Partial<BookingInput>): BookingInput {
  const firstName = cleanText(input.first_name);
  const lastName = cleanText(input.last_name);
  const email = cleanText(input.email).toLowerCase();
  const appointmentTypeId = cleanText(input.appointment_type_id);
  const startTime = cleanText(input.start_time);
  if (!appointmentTypeId) throw new Error("Appointment type is required.");
  if (!startTime) throw new Error("Appointment time is required.");
  if (!firstName || !lastName) throw new Error("First and last name are required.");
  if (!email.includes("@")) throw new Error("A valid email is required.");

  return {
    appointment_type_id: appointmentTypeId,
    start_time: startTime,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: normalizePhone(input.phone),
    company_name: cleanText(input.company_name),
    project_name: cleanText(input.project_name),
    project_id: cleanText(input.project_id),
    assigned_staff_user_id: cleanText(input.assigned_staff_user_id),
    notes: cleanText(input.notes),
    sms_consent: Boolean(input.sms_consent),
    email_consent: input.email_consent !== false,
    create_or_link_user: Boolean(input.create_or_link_user),
    show_on_project_manager: Boolean(input.show_on_project_manager),
    event_page_id: cleanText(input.event_page_id),
    source: input.source || "public"
  };
}

async function findOrCreateContact(supabase: ReturnType<typeof getSupabaseAdmin>, input: BookingInput) {
  const existing = await supabase.from("contacts").select("id").ilike("email", input.email).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id as string;

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone || null,
      company: input.company_name || null,
      type: "Lead",
      status: "active",
      source: input.source === "dashboard" ? "dashboard-booking" : "public-booking",
      notes: input.notes || null,
      last_activity: new Date().toISOString()
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function findOrCreateClientUser(supabase: ReturnType<typeof getSupabaseAdmin>, input: BookingInput, contactId: string) {
  if (!input.create_or_link_user) return null;
  const existing = await supabase.from("staff_users").select("id").ilike("email", input.email).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id as string;

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("staff_users")
    .insert({
      contact_id: contactId,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      display_name: `${input.first_name} ${input.last_name}`.trim(),
      phone: input.phone || null,
      company_name: input.company_name || null,
      role_slug: "client",
      status: "invited",
      title: "Client",
      job_title: "Client",
      invited_at: timestamp,
      invite_email_sent_at: input.email_consent ? timestamp : null,
      invite_sms_sent_at: input.sms_consent ? timestamp : null,
      notes: "Created from booking flow."
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("user_invites").insert({
    email: input.email,
    phone: input.phone || null,
    name: `${input.first_name} ${input.last_name}`.trim(),
    role_slug: "client",
    contact_id: contactId,
    staff_user_id: data.id,
    notify_email: input.email_consent,
    notify_sms: input.sms_consent,
    email_status: input.email_consent ? "queued" : "skipped",
    sms_status: input.sms_consent ? "queued" : "skipped",
    invited_by_email: "booking"
  });

  return data.id as string;
}

async function createScheduleItemForAppointment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  appointment: BookingAppointment,
  appointmentType: AppointmentType,
  input: BookingInput
) {
  if (!input.show_on_project_manager && !appointmentType.creates_project_schedule_item) return null;

  const start = dateTimeToDateKey(appointment.start_time);
  const end = dateTimeToDateKey(appointment.end_time);
  const { data, error } = await supabase
    .from("project_schedule_items")
    .insert({
      board_id: "default",
      project_id: appointment.project_id,
      type: appointmentType.default_schedule_type || "milestone",
      project_title: input.project_name || appointment.project_name || "Booked Appointment",
      title: appointment.title,
      phase: appointmentType.default_phase,
      assignee: input.assigned_staff_user_id ? null : null,
      client: `${input.first_name} ${input.last_name}`.trim(),
      participants: input.assigned_staff_user_id || null,
      start_date: start,
      end_date: end,
      status: appointment.status === "completed" ? "complete" : appointment.status === "canceled" ? "canceled" : "scheduled",
      priority: appointmentType.default_priority || "normal",
      progress: appointment.status === "completed" ? 100 : 0,
      notify: input.email_consent || input.sms_consent,
      description: input.notes || appointmentType.description,
      client_visible: appointmentType.client_visible,
      visible_on_gantt: true,
      schedule_group_key: input.project_name || appointment.project_name || "Bookings",
      template_slug: "booking",
      template_name: "Booking Appointment",
      duration_minutes: appointmentType.duration_minutes,
      metadata: { booking_appointment_id: appointment.id, appointment_type_slug: appointmentType.slug }
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("booking_appointments").update({ project_schedule_item_id: data.id }).eq("id", appointment.id);
  return data.id as string;
}

export async function createBookingAppointment(rawInput: Partial<BookingInput>) {
  const supabase = getSupabaseAdmin();
  const input = cleanBookingInput(rawInput);
  const requestedDate = new Date(input.start_time);
  if (Number.isNaN(requestedDate.getTime())) throw new Error("Appointment time is invalid.");

  const typeResult = await supabase.from("booking_appointment_types").select("*").eq("id", input.appointment_type_id).eq("is_active", true).maybeSingle();
  if (typeResult.error) throw typeResult.error;
  if (!typeResult.data) throw new Error("Appointment type was not found.");
  const appointmentType = typeResult.data as AppointmentType;

  const dateKey = dateTimeToDateKey(requestedDate);
  const slots = await loadAvailabilitySlots(input.appointment_type_id, dateKey);
  const selectedSlot = slots.find(slot => slot.start === requestedDate.toISOString());
  if (!selectedSlot) throw new Error("That appointment time is no longer available. Please choose another time.");

  const contactId = await findOrCreateContact(supabase, input);
  const clientUserId = await findOrCreateClientUser(supabase, input, contactId);
  const title = makeBookingTitle(appointmentType.name, input.first_name, input.last_name);

  const { data, error } = await supabase
    .from("booking_appointments")
    .insert({
      appointment_type_id: appointmentType.id,
      contact_id: contactId,
      staff_user_id: clientUserId,
      assigned_staff_user_id: input.assigned_staff_user_id || null,
      project_id: input.project_id || null,
      event_page_id: input.event_page_id || null,
      title,
      customer_first_name: input.first_name,
      customer_last_name: input.last_name,
      customer_email: input.email,
      customer_phone: input.phone || null,
      company_name: input.company_name || null,
      project_name: input.project_name || null,
      start_time: selectedSlot.start,
      end_time: selectedSlot.end,
      status: input.source === "dashboard" ? "confirmed" : "pending",
      timezone: "America/Phoenix",
      location_type: appointmentType.location_type,
      meeting_url: appointmentType.meeting_url,
      customer_notes: input.notes || null,
      client_visible: appointmentType.client_visible,
      show_on_project_manager: input.show_on_project_manager || appointmentType.creates_project_schedule_item,
      create_or_link_user: input.create_or_link_user,
      email_consent: input.email_consent,
      sms_consent: input.sms_consent,
      confirmed_at: input.source === "dashboard" ? new Date().toISOString() : null,
      metadata: { source: input.source }
    })
    .select("*")
    .single();
  if (error) throw error;

  const appointment = data as BookingAppointment;
  await createScheduleItemForAppointment(supabase, appointment, appointmentType, input);
  await queueCalendarSync(supabase, appointment);
  await queueBookingNotifications(supabase, appointment, appointmentType);
  // Push to staff devices (best-effort; no-op if VAPID keys aren't configured).
  await sendPushToAllSubscribers({
    title: "New booking",
    body: `${title} · ${formatPhoenixDateTime(appointment.start_time)}`,
    url: "/dashboard/bookings",
    tag: `booking-${appointment.id}`
  });
  return appointment;
}

export async function loadPublicEventPage(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("booking_event_pages")
    .select("*, booking_appointment_types(*)")
    .eq("slug", slug)
    .in("status", ["published", "private"])
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Event page was not found.");
  return data;
}

function slugify(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `event-${Date.now()}`;
}

// Capacity is optional; treat empty/zero/non-numeric as "no limit" (null).
function normalizeCapacity(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

// Build the event page metadata (event type + media + display flags). When an
// existing metadata object is passed (update), unspecified keys are preserved
// and empty values clear the key.
function buildEventMetadata(rawInput: Partial<EventPageInput>, existing?: Record<string, unknown> | null): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...(existing ?? {}) };
  const setText = (key: string, value: string) => { if (value) metadata[key] = value; else delete metadata[key]; };
  setText("event_type", cleanText(rawInput.event_type));
  setText("photo_url", cleanText(rawInput.photo_url));
  setText("video_url", cleanText(rawInput.video_url));
  if (rawInput.gallery_urls !== undefined) {
    const gallery = (Array.isArray(rawInput.gallery_urls) ? rawInput.gallery_urls : []).map(url => cleanText(url)).filter(Boolean);
    if (gallery.length) metadata.gallery_urls = gallery; else delete metadata.gallery_urls;
  }
  if (rawInput.show_spots_remaining !== undefined) metadata.show_spots_remaining = Boolean(rawInput.show_spots_remaining);
  return metadata;
}

export async function createBookingEventPage(rawInput: Partial<EventPageInput>) {
  const supabase = getSupabaseAdmin();
  const title = cleanText(rawInput.title);
  const startTime = cleanText(rawInput.start_time);
  const endTime = cleanText(rawInput.end_time);
  if (!title) throw new Error("Event title is required.");
  if (!startTime || !endTime) throw new Error("Event start and end are required.");

  const payload = {
    title,
    slug: slugify(rawInput.slug || title),
    summary: cleanText(rawInput.summary) || null,
    description: cleanText(rawInput.description) || null,
    appointment_type_id: cleanText(rawInput.appointment_type_id) || null,
    host_staff_user_id: cleanText(rawInput.host_staff_user_id) || null,
    project_id: cleanText(rawInput.project_id) || null,
    start_time: new Date(startTime).toISOString(),
    end_time: new Date(endTime).toISOString(),
    timezone: "America/Phoenix",
    location_type: cleanText(rawInput.location_type) || "in_person",
    location: cleanText(rawInput.location) || null,
    meeting_url: cleanText(rawInput.meeting_url) || null,
    capacity: normalizeCapacity(rawInput.capacity),
    requires_approval: Boolean(rawInput.requires_approval),
    client_visible: rawInput.client_visible !== false,
    show_on_project_manager: Boolean(rawInput.show_on_project_manager),
    status: rawInput.status || "draft",
    metadata: buildEventMetadata(rawInput),
    published_at: rawInput.status === "published" ? new Date().toISOString() : null
  };

  const { data, error } = await supabase.from("booking_event_pages").insert(payload).select("*").single();
  if (error) throw error;

  if (payload.show_on_project_manager) {
    const { data: scheduleItem } = await supabase
      .from("project_schedule_items")
      .insert({
        board_id: "default",
        project_id: payload.project_id,
        type: "milestone",
        project_title: title,
        title,
        phase: "Event",
        start_date: dateTimeToDateKey(payload.start_time),
        end_date: dateTimeToDateKey(payload.end_time),
        status: "scheduled",
        priority: "normal",
        progress: 0,
        notify: true,
        description: payload.summary || payload.description,
        client_visible: payload.client_visible,
        visible_on_gantt: true,
        schedule_group_key: title,
        template_slug: "event-page",
        template_name: "One-Time Event",
        duration_minutes: Math.max(15, Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 60000)),
        metadata: { booking_event_page_id: data.id, event_slug: data.slug }
      })
      .select("id")
      .single();
    if (scheduleItem?.id) {
      await supabase.from("booking_event_pages").update({ project_schedule_item_id: scheduleItem.id }).eq("id", data.id);
    }
  }

  await queueEventCalendarSync(supabase, data);
  return data;
}

export async function registerForEventPage(slug: string, rawInput: Partial<BookingInput>) {
  const supabase = getSupabaseAdmin();
  const eventPage = await loadPublicEventPage(slug);
  if (eventPage.capacity && eventPage.registration_count >= eventPage.capacity) throw new Error("This event is full.");
  const type = eventPage.booking_appointment_types as AppointmentType | null;
  if (!type?.id) throw new Error("Event appointment type is not configured.");
  const input = cleanBookingInput({
    ...rawInput,
    appointment_type_id: type.id,
    start_time: eventPage.start_time,
    event_page_id: eventPage.id,
    assigned_staff_user_id: eventPage.host_staff_user_id,
    project_id: eventPage.project_id,
    project_name: eventPage.title,
    show_on_project_manager: eventPage.show_on_project_manager,
    source: "public"
  });
  const contactId = await findOrCreateContact(supabase, input);
  const userId = await findOrCreateClientUser(supabase, input, contactId);
  const appointment = await createFixedEventAppointment(supabase, eventPage, type, input, contactId, userId);

  await supabase.from("booking_event_registrations").insert({
    event_page_id: eventPage.id,
    appointment_id: appointment.id,
    contact_id: contactId,
    staff_user_id: userId,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone || null,
    company_name: input.company_name || null,
    status: eventPage.requires_approval ? "pending_approval" : "registered",
    notes: input.notes || null
  });
  await supabase.from("booking_event_pages").update({ registration_count: Number(eventPage.registration_count || 0) + 1 }).eq("id", eventPage.id);
  await queueBookingNotifications(supabase, appointment, type);
  await queueCalendarSync(supabase, appointment);
  return appointment;
}

async function createFixedEventAppointment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventPage: Record<string, unknown>,
  type: AppointmentType,
  input: BookingInput,
  contactId: string,
  userId: string | null
) {
  const { data, error } = await supabase
    .from("booking_appointments")
    .insert({
      appointment_type_id: type.id,
      contact_id: contactId,
      staff_user_id: userId,
      assigned_staff_user_id: eventPage.host_staff_user_id || null,
      project_id: eventPage.project_id || null,
      project_schedule_item_id: eventPage.project_schedule_item_id || null,
      event_page_id: eventPage.id,
      title: `${eventPage.title}: ${input.first_name} ${input.last_name}`.trim(),
      customer_first_name: input.first_name,
      customer_last_name: input.last_name,
      customer_email: input.email,
      customer_phone: input.phone || null,
      company_name: input.company_name || null,
      project_name: String(eventPage.title || ""),
      start_time: String(eventPage.start_time),
      end_time: String(eventPage.end_time),
      timezone: "America/Phoenix",
      status: eventPage.requires_approval ? "pending" : "confirmed",
      location_type: String(eventPage.location_type || type.location_type),
      location: eventPage.location || null,
      meeting_url: eventPage.meeting_url || type.meeting_url,
      customer_notes: input.notes || null,
      client_visible: true,
      show_on_project_manager: Boolean(eventPage.show_on_project_manager),
      create_or_link_user: input.create_or_link_user,
      email_consent: input.email_consent,
      sms_consent: input.sms_consent,
      metadata: { source: "event_page", event_slug: eventPage.slug }
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BookingAppointment;
}

async function queueCalendarSync(supabase: ReturnType<typeof getSupabaseAdmin>, appointment: BookingAppointment) {
  if (!appointment.assigned_staff_user_id) return;
  const { data: connection } = await supabase
    .from("booking_calendar_connections")
    .select("id, provider, sync_direction")
    .eq("staff_user_id", appointment.assigned_staff_user_id)
    .in("status", ["connected", "pending"])
    .limit(1)
    .maybeSingle();
  await supabase.from("booking_calendar_sync_events").insert({
    connection_id: connection?.id || null,
    appointment_id: appointment.id,
    event_page_id: appointment.event_page_id || null,
    staff_user_id: appointment.assigned_staff_user_id,
    provider: connection?.provider || "manual",
    sync_direction: connection?.sync_direction || "two_way",
    sync_status: connection?.id ? "queued" : "skipped",
    payload: { title: appointment.title, start_time: appointment.start_time, end_time: appointment.end_time }
  });
}

async function queueEventCalendarSync(supabase: ReturnType<typeof getSupabaseAdmin>, eventPage: Record<string, unknown>) {
  const staffId = cleanText(eventPage.host_staff_user_id);
  if (!staffId) return;
  await supabase.from("booking_calendar_sync_events").insert({
    event_page_id: eventPage.id,
    staff_user_id: staffId,
    provider: "manual",
    sync_direction: "two_way",
    sync_status: "queued",
    payload: { title: eventPage.title, start_time: eventPage.start_time, end_time: eventPage.end_time }
  });
}

async function queueBookingNotifications(supabase: ReturnType<typeof getSupabaseAdmin>, appointment: BookingAppointment, appointmentType: AppointmentType) {
  const dateLabel = formatPhoenixDateTime(appointment.start_time);
  const customerName = [appointment.customer_first_name, appointment.customer_last_name].filter(Boolean).join(" ").trim();
  const records = [];
  if (appointment.email_consent && appointment.customer_email) {
    records.push({
      appointment_id: appointment.id,
      contact_id: appointment.contact_id,
      project_id: appointment.project_id,
      recipient_type: "customer",
      recipient_email: appointment.customer_email,
      channel: "email",
      notification_type: "booking_confirmation",
      subject: `CMI appointment received: ${appointmentType.name}`,
      body: `Hi ${customerName || "there"}, your ${appointmentType.name} request for ${dateLabel} has been received by Constructed Matter, Inc.`
    });
  }
  if (appointment.sms_consent && appointment.customer_phone) {
    records.push({
      appointment_id: appointment.id,
      contact_id: appointment.contact_id,
      project_id: appointment.project_id,
      recipient_type: "customer",
      recipient_phone: appointment.customer_phone,
      channel: "sms",
      notification_type: "booking_confirmation",
      body: `CMI: Your ${appointmentType.name} request for ${dateLabel} has been received.`
    });
  }
  records.push({
    appointment_id: appointment.id,
    contact_id: appointment.contact_id,
    project_id: appointment.project_id,
    recipient_type: "staff",
    channel: "dashboard",
    notification_type: "staff_new_booking",
    subject: `New booking: ${appointmentType.name}`,
    body: `${customerName || "A contact"} requested ${appointmentType.name} for ${dateLabel}.`
  });
  await supabase.from("booking_notifications").insert(records);
}

export async function updateBookingAppointment(id: string, rawInput: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const status = cleanText(rawInput.status) as AppointmentStatus;
  const updates: Record<string, unknown> = {
    assigned_staff_user_id: cleanText(rawInput.assigned_staff_user_id) || null,
    project_id: cleanText(rawInput.project_id) || null,
    project_name: cleanText(rawInput.project_name) || null,
    internal_notes: cleanText(rawInput.internal_notes) || null,
    updated_at: new Date().toISOString()
  };
  if (status) updates.status = status;
  if (status === "completed") updates.completed_at = new Date().toISOString();
  if (status === "canceled") {
    updates.canceled_at = new Date().toISOString();
    updates.cancellation_reason = cleanText(rawInput.cancellation_reason) || null;
  }

  const { data, error } = await supabase.from("booking_appointments").update(updates).eq("id", id).select("*").single();
  if (error) throw error;

  const appointment = data as BookingAppointment;
  if (appointment.project_schedule_item_id && status) {
    await supabase
      .from("project_schedule_items")
      .update({ status: status === "completed" ? "complete" : status === "canceled" ? "canceled" : "scheduled", progress: status === "completed" ? 100 : 0 })
      .eq("id", appointment.project_schedule_item_id);
  }

  return appointment;
}

export async function deleteBookingAppointment(id: string) {
  const supabase = getSupabaseAdmin();
  // Clean up dependent rows that may lack ON DELETE CASCADE, then remove the row.
  await supabase.from("booking_question_answers").delete().eq("appointment_id", id);
  await supabase.from("booking_notifications").delete().eq("appointment_id", id);
  const { error } = await supabase.from("booking_appointments").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function updateBookingEventPage(id: string, rawInput: Partial<EventPageInput>) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: loadError } = await supabase.from("booking_event_pages").select("*").eq("id", id).maybeSingle();
  if (loadError) throw loadError;
  if (!existing) throw new Error("Event page was not found.");

  const title = cleanText(rawInput.title) || (existing.title as string);
  const startTime = cleanText(rawInput.start_time);
  const endTime = cleanText(rawInput.end_time);
  const nextStatus = (rawInput.status || existing.status) as string;

  const updates: Record<string, unknown> = {
    title,
    summary: cleanText(rawInput.summary) || null,
    description: cleanText(rawInput.description) || null,
    appointment_type_id: cleanText(rawInput.appointment_type_id) || (existing.appointment_type_id as string | null) || null,
    host_staff_user_id: cleanText(rawInput.host_staff_user_id) || null,
    project_id: cleanText(rawInput.project_id) || null,
    location_type: cleanText(rawInput.location_type) || (existing.location_type as string) || "in_person",
    location: cleanText(rawInput.location) || null,
    meeting_url: cleanText(rawInput.meeting_url) || null,
    capacity: normalizeCapacity(rawInput.capacity),
    requires_approval: Boolean(rawInput.requires_approval),
    client_visible: rawInput.client_visible !== false,
    show_on_project_manager: Boolean(rawInput.show_on_project_manager),
    status: nextStatus,
    metadata: buildEventMetadata(rawInput, existing.metadata as Record<string, unknown> | null),
    updated_at: new Date().toISOString()
  };
  if (rawInput.slug) updates.slug = slugify(rawInput.slug);
  if (startTime) updates.start_time = new Date(startTime).toISOString();
  if (endTime) updates.end_time = new Date(endTime).toISOString();
  // Stamp published_at the first time it goes live; keep it thereafter.
  if (nextStatus === "published" && !existing.published_at) updates.published_at = new Date().toISOString();

  const { data, error } = await supabase.from("booking_event_pages").update(updates).eq("id", id).select("*").single();
  if (error) throw error;

  // Keep the linked Project Manager schedule item (if any) in sync.
  const scheduleItemId = existing.project_schedule_item_id as string | null;
  if (scheduleItemId) {
    await supabase.from("project_schedule_items").update({
      title,
      project_title: title,
      start_date: dateTimeToDateKey(data.start_time),
      end_date: dateTimeToDateKey(data.end_time),
      description: (data.summary as string) || (data.description as string) || null,
      client_visible: data.client_visible
    }).eq("id", scheduleItemId);
  }

  return data;
}

export async function deleteBookingEventPage(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("booking_event_pages").select("project_schedule_item_id").eq("id", id).maybeSingle();
  // Best-effort cleanup of the linked schedule item so it doesn't orphan.
  const scheduleItemId = existing?.project_schedule_item_id as string | null | undefined;
  if (scheduleItemId) {
    await supabase.from("project_schedule_items").delete().eq("id", scheduleItemId);
  }
  const { error } = await supabase.from("booking_event_pages").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
