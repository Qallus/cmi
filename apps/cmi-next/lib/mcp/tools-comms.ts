// Phase C MCP tools: email (Resend, from info@ with reply-to the sender),
// text messages (Twilio), email templates, message history and bookings.
// Every send is high risk (preview → cmi_confirm), counts against the daily
// cap, and passes lib/messaging/ai-send.ts: the recipient must be a known
// person allowed to receive AI messages (Settings → Claude), and opt-outs
// always win. Gmail drafts/sends and calendar invites wait for the Google key.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notificationEmailHtml } from "@/lib/email/notification-email";
import { escapeHtml } from "@/lib/messaging/send";
import { isSuppressed, normalizeAddress } from "@/lib/messaging/consent";
import { hasAiCapability } from "@/lib/ai-access/check";
import { AiSendError, aiSendLive, replyToFor, resolveRecipient, sendAiEmail, sendAiSms, type Recipient } from "@/lib/messaging/ai-send";
import { createBookingAppointment, loadAppointmentTypes, loadAvailabilitySlots, updateBookingAppointment } from "@/lib/booking/data";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import type { McpTool } from "./tools";

type Json = Record<string, unknown>;
const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const sb = () => getSupabaseAdmin();

/** Same roles that may send messages from the dashboard (lib/agent/registry sendMessage). */
const COMMS_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const canSend = (c: McpCaller) => COMMS_ROLES.includes(c.ctx.role);
const sender = (c: McpCaller) => ({ id: c.ctx.id, email: c.ctx.email, name: c.ctx.displayName });
const heldNote = () => (aiSendLive() ? null : "Held: this server isn't production, so nothing was actually sent.");

async function recipientOrThrow(channel: "email" | "sms", a: Json): Promise<Recipient> {
  try {
    return await resolveRecipient(channel, { contactId: s(a.contact_id) || null, address: s(channel === "email" ? a.to_email : a.to_phone) || null });
  } catch (err) {
    if (err instanceof AiSendError) throw new Error(err.message);
    throw err;
  }
}

function emailHtml(subject: string, body: string, from: string): { html: string; text: string } {
  const paragraphs = body.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    html: notificationEmailHtml({
      audience: "external", eyebrow: "Constructed Matter, Inc.", heading: subject, paragraphs,
      footerNote: `Sent by ${from} at Constructed Matter, Inc. Reply to this email to reach them directly.`,
    }),
    text: paragraphs.join("\n\n"),
  };
}

/** Fill {{first_name}}, {{last_name}}, {{full_name}}, {{company}} in a template. */
function fillTokens(template: string, r: Recipient, company: string | null, escape: boolean): string {
  const v = (x: string) => (escape ? escapeHtml(x) : x);
  const parts = r.name.split(" ");
  return template
    .replace(/\{\{\s*first_name\s*\}\}/gi, v(r.firstName ?? parts[0] ?? ""))
    .replace(/\{\{\s*last_name\s*\}\}/gi, v(parts.slice(1).join(" ")))
    .replace(/\{\{\s*full_name\s*\}\}/gi, v(r.name))
    .replace(/\{\{\s*company\s*\}\}/gi, v(company ?? ""));
}

async function loadTemplate(id: string) {
  const { data } = await sb().from("email_templates").select("id, name, subject, preview_text, builder_type, html, status").eq("id", id).maybeSingle();
  if (!data) throw new Error("No email template with that id.");
  if (!s(data.html)) throw new Error(`"${data.name}" has no rendered HTML yet. Open it in Communications → Templates and save it once.`);
  return data;
}

const MAX_SMS = 640;

const messageTools: McpTool[] = [
  {
    name: "cmi_message_check",
    title: "Can I message this person?",
    description: "For a contact: their email and phone, whether they've opted out of email or texts, and whether they're allowed to receive AI-sent email / texts (Settings → Claude). Check before drafting a send.",
    risk: "read",
    inputSchema: () => obj({ contact_id: str("Contact id") }, ["contact_id"]),
    run: async (a) => {
      const { data: c } = await sb().from("contacts").select("id, first_name, last_name, email, phone").eq("id", s(a.contact_id)).maybeSingle();
      if (!c) return { result: { error: "No contact with that id." } };
      const subject = { type: "contact" as const, contactId: c.id };
      const [emailOut, smsOut, aiEmail, aiSms] = await Promise.all([
        c.email ? isSuppressed("email", c.email) : Promise.resolve(false),
        c.phone ? isSuppressed("sms", c.phone) : Promise.resolve(false),
        hasAiCapability(subject, "ai_email"), hasAiCapability(subject, "ai_sms"),
      ]);
      return { result: {
        name: [c.first_name, c.last_name].filter(Boolean).join(" "),
        email: { address: c.email, opted_out: emailOut, ai_allowed: aiEmail, can_send: !!c.email && !emailOut && aiEmail },
        sms: { phone: c.phone, opted_out: smsOut, ai_allowed: aiSms, can_send: !!c.phone && !smsOut && aiSms },
        note: aiEmail && aiSms ? null : "AI messages are allowed per person in Settings → Claude (AI emails / AI text messages).",
      } };
    },
  },
  {
    name: "cmi_messages_list",
    title: "Message history",
    description: "Recent emails, texts and calls logged in CMI Communications, newest first. Filter by contact and/or channel (email, sms, call). Bodies are trimmed.",
    risk: "read",
    inputSchema: () => obj({ contact_id: str("Contact id"), channel: { type: "string", enum: ["email", "sms", "call"] }, limit: { type: "integer", minimum: 1, maximum: 100 } }),
    run: async (a) => {
      let q = sb().from("messages").select("id, direction, channel, contact_id, to_address, from_address, subject, body, status, sent_at, created_at")
        .is("archived_at", null).order("created_at", { ascending: false }).limit(Math.min(Number(a.limit) || 30, 100));
      if (s(a.contact_id)) q = q.eq("contact_id", s(a.contact_id));
      if (s(a.channel)) q = q.eq("channel", s(a.channel));
      const { data, error } = await q;
      if (error) return { result: { error: error.message } };
      return { result: { messages: (data ?? []).map((m) => ({ ...m, body: typeof m.body === "string" && m.body.length > 800 ? `${m.body.slice(0, 800)}…` : m.body })) } };
    },
  },
  {
    name: "cmi_email_send",
    title: "Send an email",
    description: "Email one person in CMI (a contact or staff member) from info@constructedmatter.com, with Reply-To set to you so replies reach you. Write the body as plain paragraphs; it's sent in the CMI email design. Only people allowed to receive AI emails (Settings → Claude) who haven't opted out. Returns a preview first; runs with cmi_confirm after the person agrees. Logged to Communications.",
    risk: "high",
    openWorld: true,
    capGroup: "email",
    available: (c) => canSend(c),
    inputSchema: () => obj({ contact_id: str("Contact id (or use to_email)"), to_email: str("Email address of a contact or staff member"), subject: str("Subject"), body: str("Message (plain text; blank lines separate paragraphs)") }, ["subject", "body"]),
    preview: async (a, c): Promise<Preview> => {
      if (!s(a.subject) || !s(a.body)) throw new Error("Give a subject and a body.");
      const r = await recipientOrThrow("email", a);
      return {
        summary: `Email ${r.name} <${r.address}>: "${s(a.subject)}"`,
        details: { to: `${r.name} <${r.address}>`, from: "info@constructedmatter.com", reply_to: replyToFor(c.ctx.email), subject: s(a.subject), body: s(a.body), live: aiSendLive() },
        entity: r.kind, recordId: r.id,
      };
    },
    execute: async (a, c) => {
      const r = await recipientOrThrow("email", a);
      const { html, text } = emailHtml(s(a.subject), s(a.body), c.ctx.displayName);
      const out = await sendAiEmail({ to: r, subject: s(a.subject), html, text, sender: sender(c) });
      return { result: { sent: out.sent, to: r.address, message_id: out.messageId, note: heldNote() }, entity: r.kind, recordId: r.id, after: { channel: "email", to: r.address, subject: s(a.subject) } };
    },
  },
  {
    name: "cmi_sms_send",
    title: "Send a text message",
    description: `Text one person in CMI (a contact) from CMI's number. Keep it short (max ${MAX_SMS} characters). Only people allowed to receive AI texts (Settings → Claude) who haven't replied STOP. Returns a preview first; runs with cmi_confirm after the person agrees. Logged to Communications.`,
    risk: "high",
    openWorld: true,
    capGroup: "sms",
    available: (c) => canSend(c),
    inputSchema: () => obj({ contact_id: str("Contact id (or use to_phone)"), to_phone: str("Phone number of a contact"), body: str("The text") }, ["body"]),
    preview: async (a, c): Promise<Preview> => {
      const body = s(a.body);
      if (!body) throw new Error("Write the message.");
      if (body.length > MAX_SMS) throw new Error(`That's ${body.length} characters; keep texts under ${MAX_SMS}.`);
      const r = await recipientOrThrow("sms", a);
      return {
        summary: `Text ${r.name} at ${r.address}: "${body.length > 80 ? `${body.slice(0, 80)}…` : body}"`,
        details: { to: `${r.name} (${r.address})`, from: "CMI's number", body, characters: body.length, sender: c.ctx.displayName, live: aiSendLive() },
        entity: r.kind, recordId: r.id,
      };
    },
    execute: async (a, c) => {
      const r = await recipientOrThrow("sms", a);
      const out = await sendAiSms({ to: r, body: s(a.body), sender: sender(c) });
      return { result: { sent: out.sent, to: normalizeAddress("sms", r.address), message_id: out.messageId, note: heldNote() }, entity: r.kind, recordId: r.id, after: { channel: "sms", to: r.address } };
    },
  },
];

const templateTools: McpTool[] = [
  {
    name: "cmi_email_templates_list",
    title: "Email templates",
    description: "The email templates in Communications (name, subject, status). Create or edit them with cmi_create_record / cmi_update_record (entity email_template); send one with cmi_email_send_template.",
    risk: "read",
    inputSchema: () => obj({ search: str("Name or subject words") }),
    run: async (a) => {
      let q = sb().from("email_templates").select("id, name, subject, builder_type, status, trigger_event, updated_at").order("updated_at", { ascending: false }).limit(100);
      if (s(a.search)) q = q.or(`name.ilike.%${s(a.search).replace(/[%_,()]/g, " ")}%,subject.ilike.%${s(a.search).replace(/[%_,()]/g, " ")}%`);
      const { data } = await q;
      return { result: { templates: data ?? [] } };
    },
  },
  {
    name: "cmi_email_template_get",
    title: "Read an email template",
    description: "One template's subject, preview text and HTML (merge tags: {{first_name}}, {{last_name}}, {{full_name}}, {{company}}).",
    risk: "read",
    inputSchema: () => obj({ id: str("Template id") }, ["id"]),
    run: async (a) => {
      const { data } = await sb().from("email_templates").select("id, name, subject, preview_text, builder_type, html, status, trigger_event, updated_at").eq("id", s(a.id)).maybeSingle();
      return { result: data ?? { error: "No template with that id." } };
    },
  },
  {
    name: "cmi_email_send_template",
    title: "Send an email template",
    description: "Send a Communications email template to one contact, with their name and company filled in. Same rules as cmi_email_send (allowed recipients only, opt-outs win, daily cap). Returns a preview first; runs with cmi_confirm.",
    risk: "high",
    openWorld: true,
    capGroup: "email",
    available: (c) => canSend(c),
    inputSchema: () => obj({ template_id: str("Template id"), contact_id: str("Contact id (or to_email)"), to_email: str("Email address of a contact or staff member"), subject: str("Override the subject (optional)") }, ["template_id"]),
    preview: async (a, c): Promise<Preview> => {
      const t = await loadTemplate(s(a.template_id));
      const r = await recipientOrThrow("email", a);
      const company = r.contactId ? (await sb().from("contacts").select("company").eq("id", r.contactId).maybeSingle()).data?.company ?? null : null;
      const subject = fillTokens(s(a.subject) || t.subject || t.name, r, company, false);
      const text = fillTokens(String(t.html), r, company, true).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return {
        summary: `Email the "${t.name}" template to ${r.name} <${r.address}> with subject "${subject}"${t.status !== "active" ? " (the template is still a draft)" : ""}.`,
        details: { to: `${r.name} <${r.address}>`, reply_to: replyToFor(c.ctx.email), subject, template: t.name, excerpt: text.slice(0, 600), live: aiSendLive() },
        entity: r.kind, recordId: r.id,
      };
    },
    execute: async (a, c) => {
      const t = await loadTemplate(s(a.template_id));
      const r = await recipientOrThrow("email", a);
      const company = r.contactId ? (await sb().from("contacts").select("company").eq("id", r.contactId).maybeSingle()).data?.company ?? null : null;
      const subject = fillTokens(s(a.subject) || t.subject || t.name, r, company, false);
      const html = fillTokens(String(t.html), r, company, true);
      const text = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const out = await sendAiEmail({ to: r, subject, html, text, sender: sender(c) });
      return { result: { sent: out.sent, to: r.address, template: t.name, message_id: out.messageId, note: heldNote() }, entity: r.kind, recordId: r.id, after: { channel: "email", template: t.id } };
    },
  },
];

// ─── Bookings ───────────────────────────────────────────────────────────────

const BOOKING_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const canBook = (c: McpCaller) => BOOKING_ROLES.includes(c.ctx.role);
const phx = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function bookingRow(id: string) {
  const { data } = await sb().from("booking_appointments").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("No booking with that id.");
  return data as Record<string, unknown>;
}

const bookingTools: McpTool[] = [
  {
    name: "cmi_bookings_list",
    title: "Bookings / appointments",
    description: "Appointments booked through CMI (consultations, site visits…) between two dates (default: the next 14 days), with customer, type, status and assigned staff. Times are Arizona time.",
    risk: "read",
    inputSchema: () => obj({ from: str("From date (default today)"), to: str("To date (default +14 days)"), status: str("pending, confirmed, completed, canceled, no_show") }),
    run: async (a) => {
      const from = s(a.from) ? new Date(s(a.from)) : new Date(new Date().toISOString().slice(0, 10));
      const to = s(a.to) ? new Date(s(a.to)) : new Date(from.getTime() + 14 * 86_400_000);
      let q = sb().from("booking_appointments").select("id, title, status, start_time, end_time, customer_first_name, customer_last_name, customer_email, customer_phone, assigned_staff_user_id, contact_id, project_name, location_type")
        .gte("start_time", from.toISOString()).lte("start_time", to.toISOString()).order("start_time").limit(200);
      if (s(a.status)) q = q.eq("status", s(a.status));
      const { data, error } = await q;
      if (error) return { result: { error: error.message } };
      return { result: { bookings: (data ?? []).map((b) => ({ ...b, when: phx(b.start_time as string) })) } };
    },
  },
  {
    name: "cmi_booking_availability",
    title: "Open booking times",
    description: "Without appointment_type_id: lists the appointment types. With one and a date: the open times that day (Arizona time). Use before cmi_booking_create.",
    risk: "read",
    inputSchema: () => obj({ appointment_type_id: str("Appointment type id"), date: str("Day (YYYY-MM-DD)") }),
    run: async (a) => {
      if (!s(a.appointment_type_id)) {
        const types = await loadAppointmentTypes();
        return { result: { appointment_types: types.map((t) => ({ id: t.id, name: t.name, duration_minutes: (t as unknown as Json).duration_minutes, location_type: t.location_type })) } };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s(a.date))) return { result: { error: "Give the date as YYYY-MM-DD." } };
      const slots = await loadAvailabilitySlots(s(a.appointment_type_id), s(a.date));
      return { result: { date: s(a.date), slots } };
    },
  },
  {
    name: "cmi_booking_create",
    title: "Book an appointment",
    description: "Book an appointment for a customer at an open time (from cmi_booking_availability). The customer gets CMI's booking confirmation, so this previews first and runs with cmi_confirm. Creates or links their contact.",
    risk: "high",
    openWorld: true,
    available: (c) => canBook(c),
    inputSchema: () => obj({
      appointment_type_id: str("Appointment type id"), start_time: str("Exact slot start (ISO, from availability)"),
      first_name: str("Customer first name"), last_name: str("Customer last name"), email: str("Customer email"), phone: str("Customer phone"),
      project_name: str("Project / address"), notes: str("Notes"), assigned_staff_user_id: str("Staff member to assign"),
    }, ["appointment_type_id", "start_time", "first_name", "last_name", "email"]),
    preview: async (a): Promise<Preview> => {
      const types = await loadAppointmentTypes();
      const type = types.find((t) => t.id === s(a.appointment_type_id));
      if (!type) throw new Error("Unknown appointment type.");
      const start = new Date(s(a.start_time));
      if (Number.isNaN(start.getTime())) throw new Error("start_time isn't a valid time.");
      const slots = await loadAvailabilitySlots(type.id, start.toLocaleDateString("en-CA", { timeZone: "America/Phoenix" }));
      if (!slots.some((x) => x.start === start.toISOString())) throw new Error("That time isn't open. Check cmi_booking_availability.");
      return {
        summary: `Book "${type.name}" for ${s(a.first_name)} ${s(a.last_name)} on ${phx(start.toISOString())} (Arizona). They'll get CMI's booking confirmation at ${s(a.email)}.`,
        details: { type: type.name, when: phx(start.toISOString()), customer: `${s(a.first_name)} ${s(a.last_name)} <${s(a.email)}>`, phone: s(a.phone) || null, project: s(a.project_name) || null },
        entity: "booking",
      };
    },
    execute: async (a) => {
      const appt = await createBookingAppointment({
        appointment_type_id: s(a.appointment_type_id), start_time: s(a.start_time), first_name: s(a.first_name), last_name: s(a.last_name),
        email: s(a.email), phone: s(a.phone) || undefined, project_name: s(a.project_name) || undefined, notes: s(a.notes) || undefined,
        assigned_staff_user_id: s(a.assigned_staff_user_id) || undefined, source: "dashboard",
      });
      return { result: { booked: true, id: appt.id, when: phx(appt.start_time), status: appt.status }, entity: "booking", recordId: appt.id, before: null, after: appt };
    },
  },
  {
    name: "cmi_booking_update",
    title: "Update a booking",
    description: "Change a booking's assigned staff, linked project, project name or internal notes, or mark it confirmed / completed / no_show. To cancel, use cmi_booking_cancel.",
    risk: "write",
    available: (c) => canBook(c),
    inputSchema: () => obj({ id: str("Booking id"), assigned_staff_user_id: str("Staff member id"), project_id: str("Project id"), project_name: str("Project name"), internal_notes: str("Internal notes"), status: { type: "string", enum: ["confirmed", "completed", "no_show"] } }, ["id"]),
    run: async (a) => {
      const before = await bookingRow(s(a.id));
      // The update helper blanks fields it isn't given, so carry the current values over.
      const merged: Json = {
        assigned_staff_user_id: "assigned_staff_user_id" in a ? s(a.assigned_staff_user_id) : before.assigned_staff_user_id,
        project_id: "project_id" in a ? s(a.project_id) : before.project_id,
        project_name: "project_name" in a ? s(a.project_name) : before.project_name,
        internal_notes: "internal_notes" in a ? s(a.internal_notes) : before.internal_notes,
        status: s(a.status) || undefined,
      };
      const after = await updateBookingAppointment(s(a.id), merged);
      return { result: { updated: true, booking: { id: after.id, status: after.status, when: phx(after.start_time) } }, entity: "booking", recordId: after.id, before, after };
    },
  },
  {
    name: "cmi_booking_cancel",
    title: "Cancel a booking",
    description: "Cancel an appointment (with a reason). The customer is affected, so this previews first and runs with cmi_confirm.",
    risk: "high",
    available: (c) => canBook(c),
    inputSchema: () => obj({ id: str("Booking id"), reason: str("Why") }, ["id"]),
    preview: async (a): Promise<Preview> => {
      const b = await bookingRow(s(a.id));
      if (b.status === "canceled") throw new Error("That booking is already canceled.");
      return { summary: `Cancel "${b.title}" on ${phx(b.start_time as string)} (Arizona)${s(a.reason) ? `: ${s(a.reason)}` : ""}.`, entity: "booking", recordId: String(b.id) };
    },
    execute: async (a) => {
      const before = await bookingRow(s(a.id));
      const after = await updateBookingAppointment(s(a.id), {
        assigned_staff_user_id: before.assigned_staff_user_id, project_id: before.project_id, project_name: before.project_name,
        internal_notes: before.internal_notes, status: "canceled", cancellation_reason: s(a.reason) || null,
      });
      return { result: { canceled: true, id: after.id }, entity: "booking", recordId: after.id, before, after };
    },
  },
];

export function commsTools(): McpTool[] {
  return [...messageTools, ...templateTools, ...bookingTools];
}
