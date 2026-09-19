// External billing for one projection: POST { month, amount, note } to record,
// DELETE ?actual_id= to remove.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { addActual, deleteActual, loadDetail } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await addActual(id, { month: String(body?.month ?? ""), amount: Number(body?.amount), note: body?.note ?? null }, actor);
    return NextResponse.json(await loadDetail(id), { status: 201 });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const actualId = new URL(request.url).searchParams.get("actual_id");
    if (!actualId) return NextResponse.json({ error: "actual_id is required." }, { status: 400 });
    await deleteActual(id, actualId, actor);
    return NextResponse.json(await loadDetail(id));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
