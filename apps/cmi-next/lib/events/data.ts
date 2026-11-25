// Event invitations: server data layer (service role). Invitations are rows of
// booking_event_pages with kind = 'invitation'; guests and RSVPs live in
// event_rsvps. Registration events (kind = 'registration') are untouched and
// still handled by lib/booking/data.ts.
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publicAppUrl } from "@/lib/twilio";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { LIMITS, normalizeDesign, publicGuestList, rsvpCounts, type RsvpInput, type EventDesign } from "./design";
import type { EventAccess, EventRsvp, EventStatus, EventSummary, InvitationEvent, PublicGuests, PublicRsvp } from "./types";

export class EventError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const EVENT_COLS =
  "id, title, slug, summary, start_time, end_time, timezone, location, status, kind, access, design_mode, design, custom_html, rsvp_deadline, allow_plus_one, host_staff_user_id, published_at, created_at, updated_at";
const RSVP_COLS =
  "id, event_page_id, token, staff_user_id, contact_id, name, email, phone, source, invited_by, sent_at, sent_channel, opened_at, status, plus_one, plus_one_name, notes, responded_at, created_at, updated_at";

const STATUSES: EventStatus[] = ["draft", "published", "private", "archived", "canceled"];
const LIVE: EventStatus[] = ["published", "private"];

export function newRsvpToken(): string {
  return randomBytes(16).toString("hex");
}

export function eventUrl(slug: string, token?: string | null): string {
  return `${publicAppUrl()}/events/${slug}${token ? `?i=${token}` : ""}`;
}

function toEvent(row: Record<string, unknown>): InvitationEvent {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    slug: row.slug as string,
    summary: (row.summary as string | null) ?? null,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    timezone: (row.timezone as string) || "America/Phoenix",
    location: (row.location as string | null) ?? null,
    status: row.status as EventStatus,
    access: (row.access as EventAccess) ?? "invite_only",
    design_mode: (row.design_mode as "theme" | "custom") ?? "theme",
    design: normalizeDesign(row.design ?? {}, undefined),
    custom_html: (row.custom_html as string | null) ?? null,
    rsvp_deadline: (row.rsvp_deadline as string | null) ?? null,
    allow_plus_one: row.allow_plus_one !== false,
    host_staff_user_id: (row.host_staff_user_id as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

function clean(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function isoOrNull(v: unknown): string | null {
  if (v === null || v === "") return null;
  const s = clean(v, 60);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const root = slugify(base) || `event-${Date.now().toString(36)}`;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    let q = sb.from("booking_event_pages").select("id").eq("slug", candidate);
    if (exceptId) q = q.neq("id", exceptId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

export type EventInput = {
  title?: unknown;
  slug?: unknown;
  summary?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  location?: unknown;
  status?: unknown;
  access?: unknown;
  allow_plus_one?: unknown;
  rsvp_deadline?: unknown;
  design?: unknown;
  design_mode?: unknown;
  custom_html?: unknown;
};

/** Turn an (untrusted) input into a column patch. Only keys present are set. */
async function eventPatch(input: EventInput, current?: InvitationEvent): Promise<Record<string, unknown>> {
  const has = (k: keyof EventInput) => Object.prototype.hasOwnProperty.call(input, k);
  const patch: Record<string, unknown> = {};
  if (has("title")) {
    const title = clean(input.title, 160);
    if (!title) throw new EventError("The event needs a title.");
    patch.title = title;
  }
  if (has("slug") && clean(input.slug)) patch.slug = await uniqueSlug(clean(input.slug, 80), current?.id);
  if (has("summary")) patch.summary = clean(input.summary, 400) || null;
  if (has("start_time")) {
    const s = isoOrNull(input.start_time);
    if (!s) throw new EventError("The start date and time aren't valid.");
    patch.start_time = s;
  }
  if (has("end_time")) {
    const e = isoOrNull(input.end_time);
    if (!e) throw new EventError("The end date and time aren't valid.");
    patch.end_time = e;
  }
  const start = (patch.start_time as string) ?? current?.start_time;
  const end = (patch.end_time as string) ?? current?.end_time;
  if (start && end && new Date(end) < new Date(start)) throw new EventError("The event ends before it starts.");
  if (has("location")) patch.location = clean(input.location, 400) || null;
  if (has("access")) patch.access = input.access === "link" ? "link" : "invite_only";
  if (has("allow_plus_one")) patch.allow_plus_one = Boolean(input.allow_plus_one);
  if (has("rsvp_deadline")) patch.rsvp_deadline = isoOrNull(input.rsvp_deadline);
  if (has("design")) patch.design = normalizeDesign(input.design, current?.design);
  if (has("custom_html")) {
    const html = typeof input.custom_html === "string" ? input.custom_html : "";
    if (Buffer.byteLength(html, "utf8") > LIMITS.customHtmlBytes) throw new EventError("The custom design is too large (500 KB max).");
    patch.custom_html = html.trim() ? html : null;
  }
  if (has("design_mode")) patch.design_mode = input.design_mode === "custom" ? "custom" : "theme";
  // Custom mode needs something to show.
  const mode = (patch.design_mode as string | undefined) ?? current?.design_mode;
  const html = has("custom_html") ? (patch.custom_html as string | null) : current?.custom_html;
  if (mode === "custom" && !html) throw new EventError("Add the custom HTML before switching to the custom design.");
  if (has("status")) {
    const status = STATUSES.includes(input.status as EventStatus) ? (input.status as EventStatus) : "draft";
    patch.status = status;
    if (LIVE.includes(status) && !current?.published_at) patch.published_at = new Date().toISOString();
  }
  return patch;
}

export async function listInvitationEvents(): Promise<EventSummary[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("booking_event_pages")
    .select(EVENT_COLS)
    .eq("kind", "invitation")
    .neq("status", "archived")
    .order("start_time", { ascending: false });
  if (error) throw new EventError(error.message, 500);
  const events = (data ?? []).map((r) => toEvent(r as Record<string, unknown>));
  const ids = events.map((e) => e.id);
  const byEvent = new Map<string, { status: string; plus_one: boolean }[]>();
  if (ids.length) {
    const { data: rows } = await sb.from("event_rsvps").select("event_page_id, status, plus_one").in("event_page_id", ids);
    for (const r of rows ?? []) {
      const list = byEvent.get(r.event_page_id as string) ?? [];
      list.push({ status: r.status as string, plus_one: Boolean(r.plus_one) });
      byEvent.set(r.event_page_id as string, list);
    }
  }
  return events.map((e) => ({ ...e, counts: rsvpCounts(byEvent.get(e.id) ?? []) }));
}

export async function getInvitationEvent(id: string): Promise<{ event: InvitationEvent; rsvps: EventRsvp[] }> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("booking_event_pages").select(EVENT_COLS).eq("id", id).eq("kind", "invitation").maybeSingle();
  if (error) throw new EventError(error.message, 500);
  if (!data) throw new EventError("Event not found.", 404);
  const { data: rsvps } = await sb.from("event_rsvps").select(RSVP_COLS).eq("event_page_id", id).order("name");
  return { event: toEvent(data as Record<string, unknown>), rsvps: (rsvps ?? []) as EventRsvp[] };
}

export async function createInvitationEvent(input: EventInput, actorId: string | null): Promise<InvitationEvent> {
  const title = clean(input.title, 160);
  if (!title) throw new EventError("The event needs a title.");
  if (!isoOrNull(input.start_time)) throw new EventError("The event needs a start date and time.");
  const patch = await eventPatch({ ...input, status: input.status ?? "draft", design: input.design ?? {} });
  const start = patch.start_time as string;
  const row = {
    ...patch,
    title,
    slug: (patch.slug as string) ?? (await uniqueSlug(title)),
    // Default to a three-hour event when no end is given.
    end_time: (patch.end_time as string) ?? new Date(new Date(start).getTime() + 3 * 3600_000).toISOString(),
    timezone: "America/Phoenix",
    location_type: "in_person",
    kind: "invitation",
    design_mode: (patch.design_mode as string | undefined) ?? "theme",
    client_visible: false,
    show_on_project_manager: false,
    requires_approval: false,
    host_staff_user_id: actorId,
    metadata: {},
  };
  const { data, error } = await getSupabaseAdmin().from("booking_event_pages").insert(row).select(EVENT_COLS).single();
  if (error) throw new EventError(error.message, 500);
  return toEvent(data as Record<string, unknown>);
}

export async function updateInvitationEvent(id: string, input: EventInput): Promise<InvitationEvent> {
  const { event } = await getInvitationEvent(id);
  const patch = await eventPatch(input, event);
  if (!Object.keys(patch).length) return event;
  const { data, error } = await getSupabaseAdmin()
    .from("booking_event_pages")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(EVENT_COLS)
    .single();
  if (error) throw new EventError(error.message, 500);
  return toEvent(data as Record<string, unknown>);
}

// ── Public page ────────────────────────────────────────────────────────────

function toPublicRsvp(r: EventRsvp): PublicRsvp {
  return { token: r.token, name: r.name, email: r.email, status: r.status, plus_one: r.plus_one, plus_one_name: r.plus_one_name, notes: r.notes };
}

/** A live invitation by slug, or null (draft, archived, not an invitation). */
export async function loadPublicInvitation(slug: string): Promise<InvitationEvent | null> {
  const { data } = await getSupabaseAdmin()
    .from("booking_event_pages")
    .select(EVENT_COLS)
    .eq("slug", slug)
    .eq("kind", "invitation")
    .in("status", LIVE)
    .maybeSingle();
  return data ? toEvent(data as Record<string, unknown>) : null;
}

export async function loadPublicGuests(event: InvitationEvent): Promise<PublicGuests> {
  const { data } = await getSupabaseAdmin().from("event_rsvps").select("name, status, plus_one").eq("event_page_id", event.id);
  return publicGuestList((data ?? []) as { name: string; status: string; plus_one: boolean }[], event.design.guest_list);
}

export async function findRsvpByToken(eventId: string, token: string): Promise<EventRsvp | null> {
  const { data } = await getSupabaseAdmin().from("event_rsvps").select(RSVP_COLS).eq("event_page_id", eventId).eq("token", token).maybeSingle();
  return (data as EventRsvp | null) ?? null;
}

/** Load a guest's own RSVP for their personal link, and note the first open. */
export async function openPersonalRsvp(event: InvitationEvent, token: string): Promise<PublicRsvp | null> {
  const rsvp = await findRsvpByToken(event.id, token);
  if (!rsvp) return null;
  if (!rsvp.opened_at) {
    await getSupabaseAdmin().from("event_rsvps").update({ opened_at: new Date().toISOString() }).eq("id", rsvp.id);
  }
  return toPublicRsvp(rsvp);
}

export function rsvpClosed(event: InvitationEvent, now = new Date()): boolean {
  if (!LIVE.includes(event.status)) return true;
  if (event.rsvp_deadline && now > endOfDay(new Date(event.rsvp_deadline))) return true;
  return now > new Date(event.end_time);
}

// A deadline of "Dec 4" means RSVPs are open all of Dec 4 (Arizona, UTC-7).
function endOfDay(d: Date): Date {
  const az = new Date(d.getTime() - 7 * 3600_000);
  az.setUTCHours(23, 59, 59, 999);
  return new Date(az.getTime() + 7 * 3600_000);
}

/**
 * Save an RSVP from the public page or an exported copy.
 * - With a token: updates that guest (personal link, or a returning open-link guest).
 * - Without one (open link only): matches by email, or adds a new guest.
 */
export async function submitPublicRsvp(
  event: InvitationEvent,
  token: string | null,
  input: RsvpInput,
): Promise<{ rsvp: PublicRsvp; isNew: boolean; changed: boolean; previous: string | null }> {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const answer = {
    status: input.status,
    plus_one: input.plus_one,
    plus_one_name: input.plus_one_name || null,
    notes: input.notes || null,
    responded_at: now,
    updated_at: now,
  };

  let existing: EventRsvp | null = null;
  if (token) {
    existing = await findRsvpByToken(event.id, token);
    if (!existing) throw new EventError("This RSVP link isn't valid for this event.", 404);
  } else {
    if (event.access !== "link") throw new EventError("This invitation is personal. Please use the link from your invite.", 403);
    const { data } = await sb.from("event_rsvps").select(RSVP_COLS).eq("event_page_id", event.id).eq("email", input.email.toLowerCase()).maybeSingle();
    existing = (data as EventRsvp | null) ?? null;
    // Knowing someone's email mustn't let you answer for an invited guest.
    if (existing && existing.source !== "link") {
      throw new EventError("You're already on the guest list. Please use the personal RSVP link from your invite.", 409);
    }
  }

  if (existing) {
    const patch: Record<string, unknown> = { ...answer };
    if (input.name && existing.source === "link") patch.name = input.name;
    if (input.phone && !existing.phone) patch.phone = input.phone;
    const { data, error } = await sb.from("event_rsvps").update(patch).eq("id", existing.id).select(RSVP_COLS).single();
    if (error) throw new EventError(error.message, 500);
    const rsvp = toPublicRsvp(data as EventRsvp);
    // Matched by email alone: never hand back the token (it reads the RSVP).
    if (!token) rsvp.token = "";
    return { rsvp, isNew: false, changed: existing.status !== input.status, previous: existing.status };
  }

  const { data, error } = await sb
    .from("event_rsvps")
    .insert({
      event_page_id: event.id,
      token: newRsvpToken(),
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      source: "link",
      ...answer,
    })
    .select(RSVP_COLS)
    .single();
  if (error) throw new EventError(error.message, 500);
  return { rsvp: toPublicRsvp(data as EventRsvp), isNew: true, changed: true, previous: null };
}

// ── Guests (staff side) ────────────────────────────────────────────────────

export type AddGuestsInput = {
  allStaff?: boolean;
  staffIds?: string[];
  contactIds?: string[];
  people?: { name?: string; email?: string; phone?: string }[];
};

export async function addGuests(eventId: string, input: AddGuestsInput, actorId: string | null): Promise<{ added: number; skipped: number }> {
  const sb = getSupabaseAdmin();
  const { rsvps } = await getInvitationEvent(eventId);
  const haveStaff = new Set(rsvps.map((r) => r.staff_user_id).filter(Boolean));
  const haveContact = new Set(rsvps.map((r) => r.contact_id).filter(Boolean));
  const haveEmail = new Set(rsvps.map((r) => r.email?.toLowerCase()).filter(Boolean));
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  const base = { event_page_id: eventId, source: "invite", invited_by: actorId };
  const push = (row: Record<string, unknown>) => {
    const email = (row.email as string | null)?.toLowerCase() ?? null;
    if (email && haveEmail.has(email)) { skipped++; return; }
    if (email) haveEmail.add(email);
    rows.push({ ...base, token: newRsvpToken(), ...row, email });
  };

  // Staff: everyone active/invited with a staff role, or the ones picked.
  const staffIds = [...new Set(input.staffIds ?? [])];
  if (input.allStaff || staffIds.length) {
    let q = sb.from("staff_users").select("id, display_name, first_name, last_name, email, phone, role_slug, status").in("status", ["active", "invited"]);
    q = input.allStaff ? q.in("role_slug", [...STAFF_ROLES]) : q.in("id", staffIds);
    const { data } = await q;
    for (const s of data ?? []) {
      if (haveStaff.has(s.id)) { skipped++; continue; }
      haveStaff.add(s.id);
      const name = (s.display_name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.email || "Guest") as string;
      push({ staff_user_id: s.id, name, email: s.email ?? null, phone: s.phone ?? null });
    }
  }

  const contactIds = [...new Set(input.contactIds ?? [])];
  if (contactIds.length) {
    const { data } = await sb.from("contacts").select("id, first_name, last_name, email, phone").in("id", contactIds);
    for (const c of data ?? []) {
      if (haveContact.has(c.id)) { skipped++; continue; }
      haveContact.add(c.id);
      const name = (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Guest") as string;
      push({ contact_id: c.id, name, email: c.email ?? null, phone: c.phone ?? null });
    }
  }

  for (const p of input.people ?? []) {
    const name = clean(p.name, 120);
    const email = clean(p.email, 200);
    if (!name && !email) continue;
    push({ name: name || email, email: email || null, phone: clean(p.phone, 40) || null });
  }

  if (rows.length) {
    const { error } = await sb.from("event_rsvps").insert(rows);
    if (error) throw new EventError(error.message, 500);
  }
  return { added: rows.length, skipped };
}

export type GuestPatch = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  status?: unknown;
  plus_one?: unknown;
  plus_one_name?: unknown;
  notes?: unknown;
};

/** Staff edit a guest, e.g. record an RSVP someone texted in. */
export async function updateGuest(eventId: string, rsvpId: string, input: GuestPatch): Promise<EventRsvp> {
  const has = (k: keyof GuestPatch) => Object.prototype.hasOwnProperty.call(input, k);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (has("name")) {
    const n = clean(input.name, 120);
    if (!n) throw new EventError("A guest needs a name.");
    patch.name = n;
  }
  if (has("email")) patch.email = clean(input.email, 200).toLowerCase() || null;
  if (has("phone")) patch.phone = clean(input.phone, 40) || null;
  if (has("status")) {
    const s = input.status;
    if (s !== "invited" && s !== "attending" && s !== "declined") throw new EventError("Status must be invited, attending or declined.");
    patch.status = s;
    patch.responded_at = s === "invited" ? null : new Date().toISOString();
    if (s !== "attending") { patch.plus_one = false; patch.plus_one_name = null; }
  }
  if (has("plus_one") && patch.status !== "declined" && patch.status !== "invited") patch.plus_one = Boolean(input.plus_one);
  if (has("plus_one_name")) patch.plus_one_name = clean(input.plus_one_name, 120) || null;
  if (has("notes")) patch.notes = clean(input.notes, 1000) || null;
  const { data, error } = await getSupabaseAdmin()
    .from("event_rsvps")
    .update(patch)
    .eq("id", rsvpId)
    .eq("event_page_id", eventId)
    .select(RSVP_COLS)
    .maybeSingle();
  if (error) throw new EventError(error.code === "23505" ? "Another guest already has that email." : error.message, error.code === "23505" ? 409 : 500);
  if (!data) throw new EventError("Guest not found.", 404);
  return data as EventRsvp;
}

export async function removeGuest(eventId: string, rsvpId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("event_rsvps").delete().eq("id", rsvpId).eq("event_page_id", eventId);
  if (error) throw new EventError(error.message, 500);
}

export type { EventDesign };
