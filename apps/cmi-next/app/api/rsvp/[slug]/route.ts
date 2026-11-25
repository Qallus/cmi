// Public RSVP endpoint for event invitations. No session: a guest proves who
// they are with the token in their personal link, or (open-link events only)
// gives a name and email. CORS is open on this route alone so an exported copy
// of the page, hosted anywhere, can still post RSVPs back to CMI.
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/flags";
import { EVENTS_FLAG } from "@/lib/events/access";
import { isRsvpToken, parseRsvpInput } from "@/lib/events/design";
import { EventError, loadPublicGuests, loadPublicInvitation, openPersonalRsvp, rsvpClosed, submitPublicRsvp } from "@/lib/events/data";
import { allowRequest } from "@/lib/events/rate-limit";
import { botReason, clientIp, verifyTurnstile } from "@/lib/spam/turnstile";
import { notifyStaff } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function liveEvent(slug: string) {
  if (!(await isFeatureEnabled(EVENTS_FLAG))) return null;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return loadPublicInvitation(slug);
}

/** The guest's own RSVP (by token) and the public guest list. */
export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const event = await liveEvent(slug);
  if (!event) return json({ error: "Not found." }, 404);
  const token = new URL(req.url).searchParams.get("i");
  const rsvp = isRsvpToken(token) ? await openPersonalRsvp(event, token) : null;
  return json({ rsvp, guests: await loadPublicGuests(event), closed: rsvpClosed(event) });
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const ip = clientIp(req.headers) ?? "unknown";
    if (!allowRequest(`rsvp:${ip}`)) return json({ error: "Too many tries. Please wait a few minutes." }, 429);

    const event = await liveEvent(slug);
    if (!event) return json({ error: "Not found." }, 404);
    if (rsvpClosed(event)) return json({ error: "RSVPs for this event are closed." }, 409);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = isRsvpToken(body.token) ? body.token : null;

    // Bots: quietly accept and drop, like the contact form.
    if (botReason(body)) return json({ ok: true, rsvp: null, guests: await loadPublicGuests(event) });
    // Open-link RSVPs (no personal token) also pass Turnstile when it's set up.
    if (!token && !(await verifyTurnstile(body.turnstile, ip))) {
      return json({ error: "Please complete the check and try again.", code: "turnstile_required" }, 400);
    }

    const parsed = parseRsvpInput(body, { needIdentity: !token, allowPlusOne: event.allow_plus_one });
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const result = await submitPublicRsvp(event, token, parsed.value);

    if (result.changed && event.host_staff_user_id) {
      const who = result.rsvp.name || parsed.value.name || "A guest";
      const verb = result.rsvp.status === "attending" ? `is coming${result.rsvp.plus_one ? " (+1)" : ""}` : "can't make it";
      await notifyStaff({
        recipientIds: [event.host_staff_user_id],
        kind: "event_rsvp",
        title: `${who} ${verb}`,
        body: event.title,
        url: `/dashboard/events?event=${event.id}`,
        sourceTable: "booking_event_pages",
        sourceId: event.id,
      });
    }

    return json({ ok: true, rsvp: result.rsvp, guests: await loadPublicGuests(event) });
  } catch (err) {
    if (err instanceof EventError) return json({ error: err.message }, err.status);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
