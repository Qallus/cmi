// The interview queue, and starting a new one.
import { NextResponse } from "next/server";
import { requireInterviews, interviewErrorResponse } from "@/lib/interviews/guard";
import { listInterviews, createInterview } from "@/lib/interviews/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireInterviews(request);
    const q = new URL(request.url).searchParams;
    return NextResponse.json(await listInterviews({
      status: q.get("status") ?? undefined,
      interviewerId: q.get("interviewer") ?? undefined,
      contactId: q.get("contact") ?? undefined,
      companyId: q.get("company") ?? undefined,
      templateId: q.get("template") ?? undefined,
      archived: q.get("archived") === "1",
      q: q.get("q") ?? undefined,
    }));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireInterviews(request);
    const body = await request.json().catch(() => ({}));
    if (!body?.template_id) return NextResponse.json({ error: "Pick a template to start from." }, { status: 400 });
    return NextResponse.json(await createInterview({
      templateId: body.template_id,
      contactId: body.contact_id ?? null,
      companyId: body.company_id ?? null,
      applicationId: body.application_id ?? null,
      interviewerId: body.interviewer_id ?? null,
      title: body.title ?? null,
      interviewType: body.interview_type ?? null,
      scheduledAt: body.scheduled_at ?? null,
      durationMinutes: body.duration_minutes ?? null,
      meetingType: body.meeting_type ?? null,
      location: body.location ?? null,
      meetingUrl: body.meeting_url ?? null,
    }, ctx.actor.id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}
