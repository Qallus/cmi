// Follow-ups are ordinary staff tasks carrying this interview's id.
import { NextResponse } from "next/server";
import { requireInterviews, interviewErrorResponse } from "@/lib/interviews/guard";
import { listFollowups, addFollowup, setFollowupDone } from "@/lib/interviews/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireInterviews(request);
    return NextResponse.json(await listFollowups((await params).id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const ctx = await requireInterviews(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await addFollowup((await params).id, {
      title: body?.title ?? "",
      description: body?.description ?? null,
      assignedTo: body?.assigned_to ?? null,
      dueAt: body?.due_at ?? null,
    }, ctx.actor.id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireInterviews(request);
    const body = await request.json().catch(() => ({}));
    if (!body?.task_id) return NextResponse.json({ error: "Which follow-up?" }, { status: 400 });
    return NextResponse.json(await setFollowupDone(body.task_id, body.done !== false, ctx.actor.id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}
