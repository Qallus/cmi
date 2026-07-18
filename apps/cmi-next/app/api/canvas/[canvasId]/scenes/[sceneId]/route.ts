import { NextResponse } from "next/server";
import { deleteScene, updateScene } from "@/lib/canvas/data";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";
import type { SceneAnnotations } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ canvasId: string; sceneId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { sceneId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      annotations?: SceneAnnotations; media_path?: string | null; source_video_path?: string | null; flattened_path?: string | null; position?: number;
    };
    const scene = await updateScene(actor, sceneId, body);
    return NextResponse.json({ scene });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ canvasId: string; sceneId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { sceneId } = await params;
    await deleteScene(actor, sceneId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
