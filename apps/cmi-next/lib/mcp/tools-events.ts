// Claude connector: event invitations (Bookings → Events). Same audience as
// Bookings, and only while the event_invitations flag is on. Everything is
// saved as a draft; going live is a high-risk step (preview → cmi_confirm).
import { isFeatureEnabled } from "@/lib/flags";
import { canManageEvents, EVENTS_FLAG } from "@/lib/events/access";
import {
  addGuests, createInvitationEvent, eventUrl, getInvitationEvent, listInvitationEvents, updateGuest, updateInvitationEvent,
} from "@/lib/events/data";
import { EVENT_THEMES } from "@/lib/events/themes";
import { rsvpCounts } from "@/lib/events/design";
import { formatWhen } from "@/lib/events/format";
import { EVENT_FIELDS_SCHEMA, eventInputFromArgs } from "@/lib/events/tool-input";
import type { EventRsvp, InvitationEvent } from "@/lib/events/types";
import { planInvites, sendInvites, type SendChannel, type SendScope } from "@/lib/events/send";
import { exportInvitationHtml } from "@/lib/events/export";
import { publicAppUrl } from "@/lib/twilio";
import type { McpCaller } from "./auth";
import type { Preview } from "./actions";
import type { Json, McpTool } from "./tools";

const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });

const allowed = async (c: McpCaller) => canManageEvents(c.ctx.role) && (await isFeatureEnabled(EVENTS_FLAG));
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function brief(e: InvitationEvent) {
  return {
    id: e.id,
    title: e.title,
    when: formatWhen(e.start_time, e.end_time),
    location: e.location,
    status: e.status,
    live: e.status === "published" || e.status === "private",
    who_can_rsvp: e.access === "link" ? "anyone with the link" : "invited guests (personal links)",
    url: eventUrl(e.slug),
  };
}

function guestRow(r: EventRsvp, slug: string) {
  return {
    id: r.id, name: r.name, email: r.email, status: r.status, plus_one: r.plus_one, plus_one_name: r.plus_one_name,
    notes: r.notes, responded_at: r.responded_at, opened: !!r.opened_at, link: eventUrl(slug, r.token),
  };
}


function sendTool(channel: SendChannel): McpTool {
  const noun = channel === "email" ? "email" : "text message";
  return {
    name: channel === "email" ? "cmi_event_send_invites" : "cmi_event_text_invites",
    title: channel === "email" ? "Email event invitations" : "Text event invitations",
    description: `Send the invitation by ${noun} to guests on an event's list, each with their personal RSVP link. scope: "unsent" (default, guests never sent one) or "waiting" (everyone who hasn't answered, as a reminder). Opted-out contacts are skipped. The event must be published. Returns a preview with every recipient first; runs with cmi_confirm after the person agrees.`,
    risk: "high",
    openWorld: true,
    capGroup: channel,
    available: allowed,
    inputSchema: () => obj({ event_id: str("Event id"), scope: { type: "string", enum: ["unsent", "waiting"] } }, ["event_id"]),
    preview: async (a): Promise<Preview> => {
      const scope = (a.scope === "waiting" ? "waiting" : "unsent") as SendScope;
      const p = await planInvites(s(a.event_id), channel, scope);
      if (!p.event.live) throw new Error("Publish the event first (cmi_event_publish) so the RSVP links work.");
      if (!p.recipients.length) throw new Error(`Nobody to ${channel === "email" ? "email" : "text"}${p.skipped.length ? ` (skipped: ${p.skipped.map((x) => `${x.name}: ${x.reason}`).join(", ")})` : ""}.`);
      return {
        summary: `Send the "${p.event.title}" invitation by ${noun} to ${p.recipients.length} guest(s), each with their own RSVP link.`,
        details: { recipients: p.recipients.map((r) => `${r.name} <${r.to}>`), skipped: p.skipped, page: p.event.url },
        entity: "event",
        recordId: p.event.id,
      };
    },
    execute: async (a) => {
      const r = await sendInvites(s(a.event_id), channel, (a.scope === "waiting" ? "waiting" : "unsent") as SendScope);
      return { result: r as unknown as Json, entity: "event", recordId: s(a.event_id) };
    },
  };
}

export function eventTools(): McpTool[] {
  return [
    {
      name: "cmi_events_list",
      title: "List event invitations",
      description: "Event invitation pages (Bookings → Events), newest first, with status, link and headcount (attending, declined, waiting, +1s).",
      risk: "read",
      available: allowed,
      inputSchema: () => obj(),
      run: async () => {
        const events = await listInvitationEvents();
        return { result: { events: events.map((e) => ({ ...brief(e), counts: e.counts })) } };
      },
    },
    {
      name: "cmi_event_get",
      title: "Get an event invitation",
      description: "One event invitation: details, full design, link, counts and the guest list (each guest's status, +1, notes and personal RSVP link).",
      risk: "read",
      available: allowed,
      inputSchema: () => obj({ event_id: str("Event id (from cmi_events_list)") }, ["event_id"]),
      run: async (a) => {
        const { event, rsvps } = await getInvitationEvent(s(a.event_id));
        return {
          result: { ...brief(event), rsvp_by: event.rsvp_deadline, allow_plus_one: event.allow_plus_one, design: event.design, counts: rsvpCounts(rsvps), guests: rsvps.map((r) => guestRow(r, event.slug)) },
          entity: "event", recordId: event.id,
        };
      },
    },
    {
      name: "cmi_event_themes",
      title: "List invitation themes",
      description: "The animated hero themes an invitation can use, with what each is for.",
      risk: "read",
      available: allowed,
      inputSchema: () => obj(),
      run: async () => ({ result: { themes: EVENT_THEMES.map((t) => ({ id: t.id, name: t.name, description: t.description, animation: t.animation })) } }),
    },
    {
      name: "cmi_event_create",
      title: "Create an event invitation (draft)",
      description: "Create an invitation page as a draft: title, start (Arizona time) and optionally end, location, RSVP-by date, +1s, open link, and the design (theme, message, sign-off, Good to know rows, guest list display). Don't invent facts the person didn't give. Returns the id and preview link. Add guests with cmi_event_guests_add, then cmi_event_publish when they're happy.",
      risk: "write",
      available: allowed,
      inputSchema: () => obj({ ...EVENT_FIELDS_SCHEMA }, ["title", "start"]),
      run: async (a, c) => {
        const event = await createInvitationEvent(eventInputFromArgs(a), c.ctx.id);
        return { result: { event: brief(event), next_step: "Review it in CMI (Bookings → Events), add guests, then publish." }, entity: "event", recordId: event.id, after: event };
      },
    },
    {
      name: "cmi_event_update",
      title: "Update an event invitation",
      description: "Change an invitation's details or design. Only the fields you pass change; design fields merge into the current design. Doesn't publish or unpublish (use cmi_event_publish).",
      risk: "write",
      available: allowed,
      inputSchema: () => obj({ event_id: str("Event id"), ...EVENT_FIELDS_SCHEMA }, ["event_id"]),
      run: async (a) => {
        const { event_id: id, ...rest } = a;
        const before = (await getInvitationEvent(s(id))).event;
        const event = await updateInvitationEvent(s(id), eventInputFromArgs(rest));
        return { result: { event: brief(event), design: event.design }, entity: "event", recordId: event.id, before, after: event };
      },
    },
    {
      name: "cmi_event_guests_add",
      title: "Add guests to an event",
      description: "Add guests to an invitation: all_staff, staff_ids, contact_ids (from contact search), and/or people [{name, email, phone}]. People already on the list are skipped. Each guest gets a personal RSVP link. Nothing is sent.",
      risk: "write",
      available: allowed,
      inputSchema: () => obj({
        event_id: str("Event id"),
        all_staff: { type: "boolean", description: "Invite every active staff member" },
        staff_ids: { type: "array", items: { type: "string" } },
        contact_ids: { type: "array", items: { type: "string" } },
        people: { type: "array", items: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } } } },
      }, ["event_id"]),
      run: async (a, c) => {
        const people = Array.isArray(a.people) ? (a.people as { name?: string; email?: string; phone?: string }[]) : [];
        const r = await addGuests(s(a.event_id), { allStaff: a.all_staff === true, staffIds: ids(a.staff_ids), contactIds: ids(a.contact_ids), people }, c.ctx.id);
        return { result: r as unknown as Json, entity: "event", recordId: s(a.event_id) };
      },
    },
    {
      name: "cmi_event_rsvps",
      title: "Event RSVPs",
      description: "Who's coming to an event: headcount (including +1s), attending, declined and still waiting, plus the dietary needs and notes for the venue.",
      risk: "read",
      available: allowed,
      inputSchema: () => obj({ event_id: str("Event id") }, ["event_id"]),
      run: async (a) => {
        const { event, rsvps } = await getInvitationEvent(s(a.event_id));
        const pick = (st: string) => rsvps.filter((r) => r.status === st).map((r) => ({ name: r.name, plus_one: r.plus_one, plus_one_name: r.plus_one_name, email: r.email }));
        return {
          result: {
            event: brief(event),
            counts: rsvpCounts(rsvps),
            attending: pick("attending"),
            declined: pick("declined"),
            waiting: pick("invited"),
            dietary_and_notes: rsvps.filter((r) => r.status === "attending" && r.notes).map((r) => ({ name: r.name, notes: r.notes })),
          },
        };
      },
    },
    {
      name: "cmi_event_rsvp_set",
      title: "Record an RSVP for a guest",
      description: "Record or change a guest's RSVP for them (e.g. they texted or emailed it). Identify the guest by guest_id, or by email or name from cmi_event_get. status: attending | declined | invited (waiting).",
      risk: "write",
      available: allowed,
      inputSchema: () => obj({
        event_id: str("Event id"),
        guest_id: str("Guest id (from cmi_event_get)"),
        email: str("Guest email, if no guest_id"),
        name: str("Guest name, if no guest_id or email"),
        status: { type: "string", enum: ["attending", "declined", "invited"] },
        plus_one: { type: "boolean" },
        plus_one_name: str("+1's name"),
        notes: str("Dietary needs or notes"),
      }, ["event_id", "status"]),
      run: async (a) => {
        const { event, rsvps } = await getInvitationEvent(s(a.event_id));
        const email = s(a.email).toLowerCase();
        const name = s(a.name).toLowerCase();
        const matches = s(a.guest_id) ? rsvps.filter((r) => r.id === s(a.guest_id))
          : email ? rsvps.filter((r) => r.email?.toLowerCase() === email)
          : name ? rsvps.filter((r) => r.name.toLowerCase().includes(name))
          : [];
        if (matches.length === 0) throw new Error("No guest matches. Add them with cmi_event_guests_add first.");
        if (matches.length > 1) return { result: { ambiguous: true, matches: matches.map((r) => ({ id: r.id, name: r.name, email: r.email })), next_step: "Ask which one, then pass guest_id." } };
        const patch: Record<string, unknown> = { status: a.status };
        for (const k of ["plus_one", "plus_one_name", "notes"] as const) if (a[k] !== undefined) patch[k] = a[k];
        const before = matches[0];
        const after = await updateGuest(event.id, before.id, patch);
        return { result: { guest: guestRow(after, event.slug) }, entity: "event", recordId: event.id, before, after };
      },
    },
    {
      name: "cmi_event_publish",
      title: "Publish or unpublish an invitation",
      description: "Make an invitation page live at its link (live: true), or take it down (live: false; responses are kept). Returns a preview first; runs with cmi_confirm after the person agrees.",
      risk: "high",
      openWorld: true,
      available: allowed,
      inputSchema: () => obj({ event_id: str("Event id"), live: { type: "boolean", description: "true to publish (default), false to unpublish" } }, ["event_id"]),
      preview: async (a): Promise<Preview> => {
        const { event, rsvps } = await getInvitationEvent(s(a.event_id));
        const live = a.live !== false;
        return {
          summary: live
            ? `Publish "${event.title}" at ${eventUrl(event.slug)}. ${event.access === "link" ? "Anyone with the link can RSVP." : `Only the ${rsvps.length} invited guest(s) can RSVP, with their personal links.`} Nothing is sent.`
            : `Take "${event.title}" offline. The link stops working; ${rsvps.length} guest record(s) and their RSVPs are kept.`,
          details: { when: formatWhen(event.start_time, event.end_time), location: event.location, theme: event.design.theme },
          entity: "event",
          recordId: event.id,
        };
      },
      execute: async (a) => {
        const before = (await getInvitationEvent(s(a.event_id))).event;
        const event = await updateInvitationEvent(s(a.event_id), { status: a.live === false ? "draft" : "published" });
        return { result: { event: brief(event) }, entity: "event", recordId: event.id, before, after: event };
      },
    },
    {
      name: "cmi_event_export_html",
      title: "Export an invitation as HTML",
      description: "The invitation page as one self-contained HTML file (animation included) to host anywhere, e.g. as an artifact or on another site. Its RSVP form posts back to CMI, so responses still show in Bookings → Events. Adding ?i=<token> from a guest's personal link loads their RSVP.",
      risk: "read",
      available: allowed,
      inputSchema: () => obj({ event_id: str("Event id") }, ["event_id"]),
      run: async (a) => {
        const { event } = await getInvitationEvent(s(a.event_id));
        return { result: { filename: `${event.slug}.html`, html: exportInvitationHtml(event, publicAppUrl()) }, entity: "event", recordId: event.id };
      },
    },
    sendTool("email"),
    sendTool("sms"),
  ];
}
