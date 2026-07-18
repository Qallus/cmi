import { NextResponse } from "next/server";
import { addComment, listComments } from "@/lib/canvas/data";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    return NextResponse.json({ comments: await listComments(actor, canvasId) });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    const body = (await request.json().catch(() => ({}))) as { body?: string };
    const comment = await addComment(actor, canvasId, body.body ?? "");
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
