// Bolt: event invitations (Bookings → Events). Offered to Bookings roles while
// the event_invitations flag is on; re-checked inside dispatch. Bolt can list,
// read RSVPs, draft a new invitation and record an RSVP someone sent in.
// Publishing and sending stay in the dashboard (or Claude, with confirmation).
import { isFeatureEnabled } from "@/lib/flags";
import { canManageEvents, EVENTS_FLAG } from "@/lib/events/access";
import { createInvitationEvent, eventUrl, getInvitationEvent, listInvitationEvents, updateGuest } from "@/lib/events/data";
import { rsvpCounts } from "@/lib/events/design";
import { formatWhen } from "@/lib/events/format";
import { EVENT_FIELDS_SCHEMA, eventInputFromArgs } from "@/lib/events/tool-input";
import type { StaffContext } from "./types";

export const EVENT_TOOL_NAMES = ["list_events", "get_event_rsvps", "create_event_draft", "record_event_rsvp"] as const;

export const EVENT_TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "list_events",
      description: "List event invitations (Bookings → Events) with date, status, link and headcount.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event_rsvps",
      description: "Who's coming to an event: headcount including +1s, attending, declined, waiting, and dietary needs/notes. Get the id from list_events.",
      parameters: { type: "object", properties: { event_id: { type: "string" } }, required: ["event_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event_draft",
      description: "Create a draft event invitation page from what the person described: title, start (YYYY-MM-DDTHH:MM Arizona time), end, location (venue\\naddress), rsvp_by, allow_plus_one, open_link, and design (theme, message, sign-off, Good to know rows). Don't invent facts. It stays a draft; they review and publish it in Bookings → Events.",
      parameters: { type: "object", properties: EVENT_FIELDS_SCHEMA, required: ["title", "start"] },
    },
  },
  {
    type: "function",
    function: {
      name: "record_event_rsvp",
      description: "Record a guest's RSVP for them (e.g. they texted it). Identify the guest by name or email; status attending | declined | invited.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string" },
          guest: { type: "string", description: "Guest name or email" },
          status: { type: "string", enum: ["attending", "declined", "invited"] },
          plus_one: { type: "boolean" },
          plus_one_name: { type: "string" },
          notes: { type: "string" },
        },
        required: ["event_id", "guest", "status"],
      },
    },
  },
];

export async function eventToolsAllowed(ctx: StaffContext): Promise<boolean> {
  return canManageEvents(ctx.role) && (await isFeatureEnabled(EVENTS_FLAG));
}

export async function runEventTool(name: string, args: Record<string, unknown>, ctx: StaffContext): Promise<Record<string, unknown>> {
  if (!(await eventToolsAllowed(ctx))) return { error: `Events aren't available to your role (${ctx.role}).` };
  const id = typeof args.event_id === "string" ? args.event_id : "";

  if (name === "list_events") {
    const events = await listInvitationEvents();
    return {
      events: events.map((e) => ({ id: e.id, title: e.title, when: formatWhen(e.start_time, e.end_time), status: e.status, url: eventUrl(e.slug), counts: e.counts })),
    };
  }

  if (name === "get_event_rsvps") {
    const { event, rsvps } = await getInvitationEvent(id);
    const names = (st: string) => rsvps.filter((r) => r.status === st).map((r) => r.name + (r.plus_one ? ` +1${r.plus_one_name ? ` (${r.plus_one_name})` : ""}` : ""));
    return {
      event: event.title,
      counts: rsvpCounts(rsvps),
      attending: names("attending"),
      declined: names("declined"),
      waiting: names("invited"),
      dietary_and_notes: rsvps.filter((r) => r.status === "attending" && r.notes).map((r) => `${r.name}: ${r.notes}`),
    };
  }

  if (name === "create_event_draft") {
    const event = await createInvitationEvent(eventInputFromArgs(args), ctx.id);
    return { created: true, id: event.id, title: event.title, when: formatWhen(event.start_time, event.end_time), edit: `/dashboard/events?event=${event.id}`, message: "Draft created. Review it, add guests and publish in Bookings → Events." };
  }

  if (name === "record_event_rsvp") {
    const { event, rsvps } = await getInvitationEvent(id);
    const q = String(args.guest ?? "").trim().toLowerCase();
    if (!q) return { error: "Which guest?" };
    const matches = rsvps.filter((r) => r.email?.toLowerCase() === q || r.name.toLowerCase().includes(q));
    if (matches.length === 0) return { error: `No guest matching "${args.guest}" on ${event.title}. Add them in Bookings → Events → Guests first.` };
    if (matches.length > 1) return { ambiguous: true, matches: matches.map((r) => `${r.name}${r.email ? ` <${r.email}>` : ""}`), message: "Several guests match; ask which one." };
    const patch: Record<string, unknown> = { status: args.status };
    for (const k of ["plus_one", "plus_one_name", "notes"] as const) if (args[k] !== undefined) patch[k] = args[k];
    const r = await updateGuest(event.id, matches[0].id, patch);
    return { updated: true, guest: r.name, status: r.status, plus_one: r.plus_one };
  }

  return { error: `Unknown event tool ${name}.` };
}
