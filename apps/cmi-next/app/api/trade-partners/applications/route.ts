// The application queue.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { listApplications } from "@/lib/prequal/review";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    const q = new URL(request.url).searchParams;
    return NextResponse.json(await listApplications({
      status: q.get("status") ?? undefined,
      includeClosed: q.get("closed") === "1",
      // Archived applications are their own view, not mixed into the queue.
      archived: q.get("archived") === "1",
      // …and once archived, status stops being a useful filter.
      ...(q.get("archived") === "1" ? { includeClosed: true } : {}),
    }));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
