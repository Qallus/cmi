// Draft an invitation from a description (typed, or dictated and transcribed
// with /api/transcribe). Returns fields only; nothing is saved here.
import { NextResponse } from "next/server";
import { requireEvents, eventErrorResponse } from "@/lib/events/guard";
import { draftEventFromDescription } from "@/lib/events/draft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireEvents(req);
    const body = (await req.json().catch(() => ({}))) as { description?: unknown };
    const draft = await draftEventFromDescription(typeof body.description === "string" ? body.description : "");
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof Error && !("status" in err)) return NextResponse.json({ error: err.message }, { status: 422 });
    return eventErrorResponse(err);
  }
}
