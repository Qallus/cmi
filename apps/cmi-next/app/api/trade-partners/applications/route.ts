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
    }));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
