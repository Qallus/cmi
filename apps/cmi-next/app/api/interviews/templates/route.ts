// The reusable questionnaires.
import { NextResponse } from "next/server";
import { requireInterviews, requireTemplateAdmin, interviewErrorResponse } from "@/lib/interviews/guard";
import { listTemplates, saveTemplate } from "@/lib/interviews/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await requireInterviews(request);
    const includeInactive = new URL(request.url).searchParams.get("all") === "1" && ctx.canManageTemplates;
    return NextResponse.json(await listTemplates({ includeInactive }));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTemplateAdmin(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await saveTemplate(body?.id ?? null, body, ctx.actor.id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}
