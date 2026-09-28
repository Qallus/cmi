// One interview: the questions, the answers, the timeline.
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/require-admin";
import { requireInterviews, interviewErrorResponse } from "@/lib/interviews/guard";
import {
  getInterview, saveAnswers, updateInterview, deleteInterview, reopenInterview,
  listEvents, listFollowups, prefilledKeys,
} from "@/lib/interviews/data";
import { getCompany } from "@/lib/companies/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireInterviews(request);
    const interview = await getInterview((await params).id);
    if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });

    const company = interview.company_id ? await getCompany(interview.company_id) : null;
    const [events, followups] = await Promise.all([
      listEvents(interview.id),
      listFollowups(interview.id),
    ]);
    return NextResponse.json({
      interview,
      company,
      events,
      followups,
      // Which answers came off the profile rather than the conversation, so the
      // workspace can say "already on file" instead of asking again.
      prefilled: prefilledKeys(interview.sections, company),
    });
  } catch (err) {
    return interviewErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const ctx = await requireInterviews(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body?.answers && typeof body.answers === "object") {
      return NextResponse.json(await saveAnswers(id, body.answers, ctx.actor.id));
    }
    if (body?.reopen === true) {
      return NextResponse.json(await reopenInterview(id, ctx.actor.id));
    }
    return NextResponse.json(await updateInterview(id, body, ctx.actor.id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}

/** Permanent, and Super Admin only — archiving is the reversible option. */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const ctx = await requireInterviews(request);
    if (ctx.staff.role_slug !== "super_admin") {
      throw new AuthError(`Your role (${ctx.staff.role_slug}) cannot delete an interview. Archive it instead.`, 403);
    }
    return NextResponse.json(await deleteInterview((await params).id));
  } catch (err) {
    return interviewErrorResponse(err);
  }
}
