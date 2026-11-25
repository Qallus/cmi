import { NextResponse } from "next/server";
import { requireEvents, eventErrorResponse } from "@/lib/events/guard";
import { addGuests, removeGuest, updateGuest, EventError } from "@/lib/events/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : []);

/** Add guests: { allStaff?, staffIds?, contactIds?, people?: [{name,email,phone}] } */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { actorId } = await requireEvents(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const people = Array.isArray(body.people) ? (body.people as { name?: string; email?: string; phone?: string }[]).slice(0, 500) : [];
    const result = await addGuests(id, { allStaff: body.allStaff === true, staffIds: ids(body.staffIds), contactIds: ids(body.contactIds), people }, actorId);
    return NextResponse.json(result);
  } catch (err) {
    return eventErrorResponse(err);
  }
}

/** Edit one guest or record their RSVP: { rsvpId, ...fields } */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireEvents(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.rsvpId !== "string") throw new EventError("Which guest?");
    const { rsvpId, ...patch } = body;
    const rsvp = await updateGuest(id, rsvpId as string, patch);
    return NextResponse.json({ rsvp });
  } catch (err) {
    return eventErrorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireEvents(req);
    const { id } = await params;
    const rsvpId = new URL(req.url).searchParams.get("rsvpId");
    if (!rsvpId) throw new EventError("Which guest?");
    await removeGuest(id, rsvpId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return eventErrorResponse(err);
  }
}
