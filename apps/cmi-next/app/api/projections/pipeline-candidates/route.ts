// Deals and Pre-Con opportunities that can be added as anticipated work.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { listPipelineCandidates } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProjections(request);
    return NextResponse.json(await listPipelineCandidates());
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
