// Approve as Trade Partner (sends the onboarding email) or Decline (reason → Archive).
import { NextResponse } from "next/server";
import { requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { approve, decline } from "@/lib/prequal/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requirePrequalDecide(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: string; note?: string; reason?: string };
    if (body.action === "approve") return NextResponse.json({ ok: true, ...(await approve(id, actor.id, body.note?.trim() || null)) });
    if (body.action === "decline") return NextResponse.json({ ok: true, ...(await decline(id, actor.id, String(body.reason ?? ""))) });
    return NextResponse.json({ error: "Approve or decline?" }, { status: 400 });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
