// Pull current jobs, pre-con budgets and leads onto an existing report.
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { populateFromRecords, getReport } from "@/lib/reporting/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireReportingWrite(request);
    const { id } = await params;
    const added = await populateFromRecords(id);
    return NextResponse.json({ added, report: await getReport(id) });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
