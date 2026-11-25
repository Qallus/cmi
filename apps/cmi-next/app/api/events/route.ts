import { NextResponse } from "next/server";
import { requireEvents, eventErrorResponse } from "@/lib/events/guard";
import { createInvitationEvent, listInvitationEvents } from "@/lib/events/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireEvents(req);
    return NextResponse.json({ events: await listInvitationEvents() });
  } catch (err) {
    return eventErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { actorId } = await requireEvents(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const event = await createInvitationEvent(body, actorId);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return eventErrorResponse(err);
  }
}
