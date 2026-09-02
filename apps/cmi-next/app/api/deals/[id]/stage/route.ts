// Change a deal's stage (records history; closed_won triggers the Pre-Con handoff).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { changeStage, loadStageHistory, StageChangeError } from "@/lib/deals/data";
import { isDealStage } from "@/lib/deals/stages";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

// GET returns the stage history for a deal.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadStageHistory(id));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't change deal stages.` }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (!isDealStage(body?.to)) return NextResponse.json({ error: "A valid target stage is required." }, { status: 400 });

    const updated = await changeStage(id, body.to, body.patch ?? {}, { name: user.email, id: staff.id }, body.note ?? null);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof StageChangeError) {
      return NextResponse.json({ error: err.message, missing: err.missing }, { status: err.status });
    }
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
