import { NextResponse } from "next/server";
import { createCanvas, listCanvases } from "@/lib/canvas/data";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireCanvasActor(request);
    const { searchParams } = new URL(request.url);
    const canvases = await listCanvases(actor, {
      jobId: searchParams.get("jobId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    return NextResponse.json({ canvases });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCanvasActor(request);
    const body = (await request.json().catch(() => ({}))) as { title?: string; job_id?: string | null; project_id?: string | null };
    const canvas = await createCanvas(actor, body);
    return NextResponse.json({ canvas }, { status: 201 });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}
