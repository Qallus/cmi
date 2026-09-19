// One projection: GET detail (official vs forecast, months, history), PATCH
// forecast overrides (optionally respreading), DELETE = archive, or with
// ?permanent=1 delete for good (Super Admin only).
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { loadDetail, updateProjection, archiveProjection, deleteProjectionPermanently } from "@/lib/projections/data";

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
    const { actor, staff } = await requireProjections(request);
    const { id } = await params;
    if (new URL(request.url).searchParams.get("permanent") === "1") {
      if (staff.role_slug !== "super_admin") return NextResponse.json({ error: "Only a Super Admin can permanently delete a projection." }, { status: 403 });
      await deleteProjectionPermanently(id, actor);
      return NextResponse.json({ ok: true, deleted: true });
    }
    await archiveProjection(id, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
