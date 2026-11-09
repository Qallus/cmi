// Client approves, doesn't approve, asks for a change to, or comments on a selection.
import { NextResponse } from "next/server";
import { requireClient, assertJobAccess, getJobPerms, ClientAuthError } from "@/lib/client-portal/auth";
import { clientCan } from "@/lib/client-portal/permissions";
import { clientDecideSelection, type ClientSelectionAction } from "@/lib/job-selections/data";

const ACTIONS: ClientSelectionAction[] = ["approved", "rejected", "revision_requested", "comment"];

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string; selId: string }> }) {
  try {
    const { contact } = await requireClient(request);
    const { jobId, selId } = await params;
    await assertJobAccess(contact.id, jobId);
    if (!clientCan(await getJobPerms(contact.id, jobId), "locked_selections")) {
      return NextResponse.json({ error: "Selections are not enabled for your account." }, { status: 403 });
    }
    const { decision, comment } = await request.json() as { decision?: string; comment?: string };
    if (!ACTIONS.includes(decision as ClientSelectionAction)) {
      return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
    }
    const note = comment?.trim() ?? "";
    if (decision !== "approved" && !note) {
      return NextResponse.json({ error: decision === "comment" ? "Please write a comment." : "Please add a note so your team knows what you'd like instead." }, { status: 400 });
    }
    if (note.length > 2000) return NextResponse.json({ error: "Please keep comments under 2,000 characters." }, { status: 400 });
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || "Client";
    return NextResponse.json(await clientDecideSelection(selId, jobId, decision as ClientSelectionAction, note || null, { id: contact.id, name }));
  } catch (err) {
    const e = err as ClientAuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
