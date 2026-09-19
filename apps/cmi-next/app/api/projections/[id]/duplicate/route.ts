// Duplicate an anticipated projection (scenario planning).
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { duplicateProjection } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    return NextResponse.json(await duplicateProjection(id, actor), { status: 201 });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
