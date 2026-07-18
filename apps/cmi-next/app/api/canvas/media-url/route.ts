import { NextResponse } from "next/server";
import { canActorAccess, CanvasError, getCanvas } from "@/lib/canvas/data";
import { getCanvasMediaUrl } from "@/lib/canvas/storage";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

// Exchange a stored media path for a short-lived signed read URL — but only if
// the actor can access the canvas that owns the path (path prefix = canvas id).
export async function POST(request: Request) {
  try {
    const actor = await requireCanvasActor(request);
    const body = (await request.json().catch(() => ({}))) as { path?: string };
    const path = body.path?.trim();
    if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

    const canvasId = path.split("/")[0];
    const canvas = await getCanvas(canvasId);
    if (!canvas) throw new CanvasError("Media not found.", 404);
    if (!canActorAccess(actor, canvas)) throw new CanvasError("You don't have access to this media.", 403);

    const url = await getCanvasMediaUrl(path);
    if (!url) throw new CanvasError("Could not sign this media.", 500);
    return NextResponse.json({ url });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
