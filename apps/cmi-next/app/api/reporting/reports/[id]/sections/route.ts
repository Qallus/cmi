// Add a custom section to a report.
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { addSection } from "@/lib/reporting/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireReportingWrite(request);
    const body = await request.json().catch(() => ({}));
    if (!body?.title?.trim()) return NextResponse.json({ error: "A section title is required." }, { status: 400 });
    return NextResponse.json(await addSection((await params).id, body.title), { status: 201 });
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
