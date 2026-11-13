// Move a Pre-Con record back to the Pipeline (one home per project,
// lib/handoff/move.ts). Body: { stage } — the Pipeline stage it goes back to.
// Its deal returns to that stage and the Pre-Con record is archived (kept, with
// its number); winning the deal again brings the same record back.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { WRITE_ROLES } from "@/lib/records-io/fields";
import { movePreconBackToPipeline, MoveError } from "@/lib/handoff/move";
import { StageChangeError } from "@/lib/deals/data";
import type { DealStage } from "@/lib/deals/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.precon.includes(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't move Pre-Con records.` }, { status: 403 });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { stage?: DealStage };
    const r = await movePreconBackToPipeline(id, body.stage ?? "negotiation", { name: user.email, id: staff.id });
    return NextResponse.json(r);
  } catch (err) {
    if (err instanceof MoveError || err instanceof StageChangeError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
