// Client approves or requests changes on a selection.
import { NextResponse } from "next/server";
import { requireClient, assertJobAccess, getJobPerms, ClientAuthError } from "@/lib/client-portal/auth";
import { clientCan } from "@/lib/client-portal/permissions";
import { clientDecideSelection } from "@/lib/job-selections/data";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string; selId: string }> }) {
  try {
    const { contact } = await requireClient(request);
    const { jobId, selId } = await params;
    await assertJobAccess(contact.id, jobId);
    if (!clientCan(await getJobPerms(contact.id, jobId), "locked_selections")) {
      return NextResponse.json({ error: "Selections are not enabled for your account." }, { status: 403 });
    }
    const { decision, comment } = await request.json() as { decision?: string; comment?: string };
    if (decision !== "approved" && decision !== "revision_requested") {
      return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
    }
    if (decision === "revision_requested" && !comment?.trim()) {
      return NextResponse.json({ error: "Please add a note describing the change you'd like." }, { status: 400 });
    }
    return NextResponse.json(await clientDecideSelection(selId, jobId, decision, comment?.trim() ?? null));
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
