// Remove a section (and everything filed under it).
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { deleteSection } from "@/lib/reporting/data";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireReportingWrite(request);
    await deleteSection((await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
