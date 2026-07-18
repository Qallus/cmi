import { NextResponse } from "next/server";
import { canActorWrite, CanvasError, getCanvas, setPinTranscript } from "@/lib/canvas/data";
import { transcribeCanvasAudio } from "@/lib/canvas/transcribe";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

// Transcribe a voice pin's audio and store the result on its canvas_pins row.
// Requires write access to the owning canvas (path prefix = canvas id).
export async function POST(request: Request) {
  try {
    const actor = await requireCanvasActor(request);
    const body = (await request.json().catch(() => ({}))) as { path?: string; client_key?: string };
    const path = body.path?.trim();
    if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

    const canvas = await getCanvas(path.split("/")[0]);
    if (!canvas) throw new CanvasError("Canvas not found.", 404);
    if (!canActorWrite(actor, canvas)) throw new CanvasError("You can't transcribe on this canvas.", 403);

    const result = await transcribeCanvasAudio(path);
    if ("error" in result) {
      if (body.client_key) await setPinTranscript(body.client_key, "", "failed").catch(() => {});
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    if (body.client_key) await setPinTranscript(body.client_key, result.transcript, "done").catch(() => {});
    return NextResponse.json({ transcript: result.transcript });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
