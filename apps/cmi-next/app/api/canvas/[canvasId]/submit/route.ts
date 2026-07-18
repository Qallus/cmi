import { NextResponse } from "next/server";
import { submitCanvas } from "@/lib/canvas/data";
import { notifyBriefSubmitted } from "@/lib/canvas/notify";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

// Submit a draft canvas as a brief → status "submitted"; notify the team.
export async function POST(request: Request, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const actor = await requireCanvasActor(request);
    const { canvasId } = await params;
    const body = (await request.json().catch(() => ({}))) as { bolt_summary?: unknown };
    const canvas = await submitCanvas(actor, canvasId, { bolt_summary: body.bolt_summary });
    await notifyBriefSubmitted(canvas).catch(() => {});
    return NextResponse.json({ canvas });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
