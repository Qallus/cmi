// One meeting report: read, rename / finalise, delete.
import { NextResponse } from "next/server";
import { requireReporting, requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { getReport, updateReport, deleteReport } from "@/lib/reporting/data";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireReporting(request);
    const report = await getReport((await params).id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    return NextResponse.json(report);
  } catch (err) {
    return reportingErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await requireReportingWrite(request);
    return NextResponse.json(await updateReport((await params).id, await request.json()));
  } catch (err) {
    return reportingErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireReportingWrite(request);
    await deleteReport((await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
