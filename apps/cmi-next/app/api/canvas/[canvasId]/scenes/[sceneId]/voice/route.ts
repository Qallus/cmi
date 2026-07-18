import { NextResponse } from "next/server";
import { addVoicePin } from "@/lib/canvas/data";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

// Record a voice pin's audio path (already uploaded via a signed URL) against a
// scene. The pin marker itself lives in the scene annotations jsonb.
export async function POST(request: Request, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { sceneId } = await params;
    const body = (await request.json().catch(() => ({}))) as { client_key?: string; audio_path?: string };
    if (!body.client_key || !body.audio_path) return NextResponse.json({ error: "client_key and audio_path are required." }, { status: 400 });
    const pin = await addVoicePin(actor, sceneId, { client_key: body.client_key, audio_path: body.audio_path });
    return NextResponse.json({ pin }, { status: 201 });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
