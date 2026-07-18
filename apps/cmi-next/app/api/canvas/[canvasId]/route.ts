import { NextResponse } from "next/server";
import { deleteCanvas, getCanvasWithScenes, updateCanvas } from "@/lib/canvas/data";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";
import type { CanvasStatus } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    const { canvas, scenes } = await getCanvasWithScenes(actor, canvasId);
    return NextResponse.json({ canvas, scenes });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    const body = (await request.json().catch(() => ({}))) as { title?: string; status?: CanvasStatus; job_id?: string | null; project_id?: string | null };
    const canvas = await updateCanvas(actor, canvasId, body);
    return NextResponse.json({ canvas });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    await deleteCanvas(actor, canvasId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
