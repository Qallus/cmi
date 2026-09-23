// Every open action item across reports, for the by-person view.
import { NextResponse } from "next/server";
import { requireReporting, reportingErrorResponse } from "@/lib/reporting/guard";
import { loadOpenActions } from "@/lib/reporting/data";

export async function GET(request: Request) {
  try {
    await requireReporting(request);
    return NextResponse.json(await loadOpenActions());
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
