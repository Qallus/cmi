// Add a line item to a report section.
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { addItem } from "@/lib/reporting/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireReportingWrite(request);
    const body = await request.json().catch(() => ({}));
    if (!body?.section_id) return NextResponse.json({ error: "A section is required." }, { status: 400 });
    return NextResponse.json(await addItem((await params).id, body.section_id, body), { status: 201 });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
