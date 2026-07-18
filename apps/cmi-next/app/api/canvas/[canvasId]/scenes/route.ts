import { NextResponse } from "next/server";
import { addScene, reorderScenes } from "@/lib/canvas/data";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    const body = (await request.json().catch(() => ({}))) as { media_path?: string | null; source_video_path?: string | null };
    const scene = await addScene(actor, canvasId, body);
    return NextResponse.json({ scene }, { status: 201 });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}

// Reorder: body { order: [sceneId, ...] }.
export async function PATCH(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    const body = (await request.json().catch(() => ({}))) as { order?: string[] };
    if (!Array.isArray(body.order)) return NextResponse.json({ error: "order[] is required." }, { status: 400 });
    await reorderScenes(actor, canvasId, body.order);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
