// Create an anticipated projection (manual, or from a deal / Pre-Con opportunity).
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { createAnticipated } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { actor } = await requireProjections(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    return NextResponse.json(await createAnticipated({ ...body, revenue: Number(body.revenue ?? 0) }, actor), { status: 201 });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
