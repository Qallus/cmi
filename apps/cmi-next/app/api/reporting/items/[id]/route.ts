// Edit or remove one line item. Editing the narrative update on a linked item
// also posts it to that record's own timeline.
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { updateItem, deleteItem, moveItem } from "@/lib/reporting/data";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { actor } = await requireReportingWrite(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.section_id && typeof body.sort_order === "number") {
      await moveItem(id, body.section_id, body.sort_order);
    }
    return NextResponse.json(await updateItem(id, body, actor));
  } catch (err) {
    return reportingErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireReportingWrite(request);
    await deleteItem((await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
