// One projection: GET detail (official vs forecast, months, history), PATCH
// forecast overrides (optionally respreading), DELETE = remove (archive).
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { loadDetail, updateProjection, archiveProjection } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireProjections(request);
    const { id } = await params;
    return NextResponse.json(await loadDetail(id));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    await updateProjection(id, body, actor);
    return NextResponse.json(await loadDetail(id));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    await archiveProjection(id, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
