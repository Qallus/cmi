// Edit, complete or remove one action item.
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { updateAction, deleteAction } from "@/lib/reporting/data";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await requireReportingWrite(request);
    return NextResponse.json(await updateAction((await params).id, await request.json()));
  } catch (err) {
    return reportingErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireReportingWrite(request);
    await deleteAction((await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
