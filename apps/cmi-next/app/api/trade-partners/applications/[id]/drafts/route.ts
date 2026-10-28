// Pre-filled follow-up drafts for this applicant (edited in the drawer before sending).
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { buildDrafts } from "@/lib/prequal/decisions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requirePrequal(request);
    return NextResponse.json(await buildDrafts((await params).id, actor.id));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
