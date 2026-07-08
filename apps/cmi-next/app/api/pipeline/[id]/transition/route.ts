// Stage transition endpoint. Body: { to: PipelineStage, patch?: {...}, note?: string }.
// Enforces: allowed-path map, required fields for the target stage, and the
// admin-only guardrail for reopening a Closed project back into Warranty.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { transitionStage, TransitionError, getOpportunity } from "@/lib/pipeline/data";
import { transitionRequiresAdmin } from "@/lib/pipeline/stages";
import type { PipelineStage } from "@/lib/pipeline/types";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];
const ADMIN_ROLES = ["super_admin", "admin"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const { user, staff } = ctx;
  if (!WRITE_ROLES.includes(staff.role_slug)) {
    return NextResponse.json({ error: `Your role (${staff.role_slug}) can't move opportunities.` }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as
    | { to?: PipelineStage; patch?: Record<string, unknown>; note?: string }
    | null;
  const to = body?.to;
  if (!to) return NextResponse.json({ error: "Missing target stage `to`." }, { status: 400 });

  // Admin-only guardrail: reopening a closed record.
  const current = await getOpportunity(id);
  if (current && transitionRequiresAdmin(current.stage, to) && !ADMIN_ROLES.includes(staff.role_slug)) {
    return NextResponse.json({ error: "Only an admin can reopen a closed project." }, { status: 403 });
  }

  try {
    const updated = await transitionStage(id, to, (body?.patch ?? {}) as never, { name: user.email, id: staff.id }, body?.note ?? null);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof TransitionError) {
      return NextResponse.json({ error: err.message, missing: err.missing }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Transition failed." }, { status: 500 });
  }
}
