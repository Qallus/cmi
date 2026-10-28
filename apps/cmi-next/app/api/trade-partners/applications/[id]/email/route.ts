// Send an edited follow-up draft to the applicant (from info@, replies to the reviewer).
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { sendDraft } from "@/lib/prequal/decisions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requirePrequal(request);
    const body = (await request.json().catch(() => ({}))) as { kind?: string; subject?: string; body?: string };
    if (body.kind !== "meeting" && body.kind !== "missing") return NextResponse.json({ error: "Which email?" }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await sendDraft((await params).id, actor.id, { kind: body.kind, subject: String(body.subject ?? ""), body: String(body.body ?? "") })) });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
