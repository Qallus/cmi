// "What changed since ..." - the field-level log, grouped by record.
import { NextResponse } from "next/server";
import { requireReporting, reportingErrorResponse } from "@/lib/reporting/guard";
import { loadChanges } from "@/lib/reporting/data";

export async function GET(request: Request) {
  try {
    await requireReporting(request);
    const url = new URL(request.url);
    const since = url.searchParams.get("since");
    if (!since) return NextResponse.json({ error: "A start date is required." }, { status: 400 });
    return NextResponse.json(await loadChanges(since, url.searchParams.get("until") ?? undefined));
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
