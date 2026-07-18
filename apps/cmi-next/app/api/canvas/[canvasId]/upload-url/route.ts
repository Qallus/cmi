import { NextResponse } from "next/server";
import { canActorWrite, CanvasError, getCanvas } from "@/lib/canvas/data";
import { createCanvasUploadUrl } from "@/lib/canvas/storage";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

// Issue a signed upload URL the browser PUTs media to directly. Requires write
// access to the canvas. Objects are namespaced under the canvas id (and scene
// id when provided) so media-url access checks can key off the path prefix.
export async function POST(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    const canvas = await getCanvas(canvasId);
    if (!canvas) throw new CanvasError("Canvas not found.", 404);
    if (!canActorWrite(actor, canvas)) throw new CanvasError("You can't upload to this canvas.", 403);

    const body = (await request.json().catch(() => ({}))) as { sceneId?: string; filename?: string; sub?: string };
    const filename = body.filename?.trim() || "upload";
    const parts = [canvasId, body.sceneId, body.sub].filter(Boolean) as string[];
    const folder = parts.join("/");
    const result = await createCanvasUploadUrl(folder, filename);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result);
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
