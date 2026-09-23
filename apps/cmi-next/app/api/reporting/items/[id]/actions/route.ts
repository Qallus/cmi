// Add an action item to a line item.
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { addAction } from "@/lib/reporting/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireReportingWrite(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await addAction((await params).id, body), { status: 201 });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
