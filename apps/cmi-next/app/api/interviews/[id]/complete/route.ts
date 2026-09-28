// Close the interview and push what was learned onto the company profile.
import { NextResponse } from "next/server";
import { requireInterviews, interviewErrorResponse } from "@/lib/interviews/guard";
import { completeInterview } from "@/lib/interviews/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireInterviews(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await completeInterview((await params).id, {
      applyToProfile: body?.apply_to_profile !== false,
      summary: typeof body?.summary === "string" ? body.summary : null,
    }, ctx.actor.id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}
