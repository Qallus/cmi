// One application: everything the applicant sent, plus what still needs chasing.
import { NextResponse } from "next/server";
import { requirePrequal, requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { getApplicationDetail, setApplicationStatus, assignReviewer } from "@/lib/prequal/review";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requirePrequal(request);
    const detail = await getApplicationDetail((await params).id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id } = await params;

    // Approving or declining is a decision; picking it up for review isn't.
    const decisive = body?.status === "approved" || body?.status === "declined";
    const ctx = decisive ? await requirePrequalDecide(request) : await requirePrequal(request);

    if (typeof body?.reviewer_id !== "undefined") {
      return NextResponse.json(await assignReviewer(id, body.reviewer_id || null));
    }
    if (typeof body?.status === "string") {
      return NextResponse.json(await setApplicationStatus(id, body.status, {
        reason: typeof body.reason === "string" ? body.reason : null,
        actorId: ctx.actor.id,
      }));
    }
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
