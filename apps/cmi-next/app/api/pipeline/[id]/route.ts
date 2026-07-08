// Single opportunity: update (field edits, not stage moves) + delete.
// Stage moves must go through /api/pipeline/[id]/transition so they are validated.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateOpportunity, deleteOpportunity } from "@/lib/pipeline/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const DELETE_ROLES = ["super_admin", "admin"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't edit opportunities.` }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    // Guardrail: stage changes are not allowed here — use the transition route
    // so allowed-path + required-field rules are enforced.
    if ("stage" in body) delete body.stage;
    return NextResponse.json(await updateOpportunity(id, body));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!DELETE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't delete opportunities.` }, { status: 403 });
    }
    const { id } = await params;
    await deleteOpportunity(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
