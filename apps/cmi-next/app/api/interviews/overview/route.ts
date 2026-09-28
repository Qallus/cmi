// Everything the Interviews tab needs in one request.
//
// The tab lives inside Trade Partners, which already loads three other
// datasets on the server. Fetching this lazily when the tab is first opened
// keeps that page's load unchanged for people who never open it.
import { NextResponse } from "next/server";
import { requireInterviews, interviewErrorResponse } from "@/lib/interviews/guard";
import { listInterviews, listTemplates, interviewStats } from "@/lib/interviews/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireInterviews(request);
    const [interviews, templates, stats] = await Promise.all([
      listInterviews(),
      listTemplates(),
      interviewStats(),
    ]);
    return NextResponse.json({ interviews, templates, stats });
  } catch (err) {
    return interviewErrorResponse(err);
  }
}
