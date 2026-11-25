import { NextResponse } from "next/server";
import { requireEvents, eventErrorResponse } from "@/lib/events/guard";
import { eventUrl, getInvitationEvent, updateInvitationEvent } from "@/lib/events/data";
import { rsvpCounts } from "@/lib/events/design";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireEvents(req);
    const { id } = await params;
    const { event, rsvps } = await getInvitationEvent(id);
    return NextResponse.json({
      event,
      rsvps: rsvps.map((r) => ({ ...r, link: eventUrl(event.slug, r.token) })),
      counts: rsvpCounts(rsvps),
      url: eventUrl(event.slug),
    });
  } catch (err) {
    return eventErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireEvents(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const event = await updateInvitationEvent(id, body);
    return NextResponse.json({ event, url: eventUrl(event.slug) });
  } catch (err) {
    return eventErrorResponse(err);
  }
}

/** Archive (not delete): RSVPs are kept and the public link stops working. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireEvents(req);
    const { id } = await params;
    await updateInvitationEvent(id, { status: "archived" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return eventErrorResponse(err);
  }
}
