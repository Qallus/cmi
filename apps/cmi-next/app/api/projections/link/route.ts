// Is this deal / opportunity / job in Projections? Used by "Add to Projections"
// buttons elsewhere. Non-admins (or flag off) get 403/404 and hide the button.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { findLink } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProjections(request);
    const q = new URL(request.url).searchParams;
    const projection_id = await findLink({ deal_id: q.get("deal_id"), opportunity_id: q.get("opportunity_id"), job_id: q.get("job_id") });
    return NextResponse.json({ projection_id });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
