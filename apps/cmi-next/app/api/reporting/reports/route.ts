// Meeting reports: list + create.
import { NextResponse } from "next/server";
import { requireReporting, requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { listReports, createReport } from "@/lib/reporting/data";

export async function GET(request: Request) {
  try {
    await requireReporting(request);
    return NextResponse.json(await listReports());
  } catch (err) {
    return reportingErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { actor } = await requireReportingWrite(request);
    const body = await request.json().catch(() => ({}));
    if (!body?.meeting_date) return NextResponse.json({ error: "A meeting date is required." }, { status: 400 });
    return NextResponse.json(await createReport(body, actor), { status: 201 });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
