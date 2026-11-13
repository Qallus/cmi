// Move a Job back to Pre-Con (one home per project, lib/handoff/move.ts): the Job
// is archived (everything kept) and its Pre-Con record comes back. Moving it to
// Active Project again restores the same Job.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { WRITE_ROLES } from "@/lib/records-io/fields";
import { moveJobBackToPrecon, MoveError } from "@/lib/handoff/move";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.jobs.includes(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't move jobs.` }, { status: 403 });
    const { id } = await params;
    const r = await moveJobBackToPrecon(id, { name: user.email, id: staff.id }, { canReopen: ["super_admin", "admin"].includes(staff.role_slug) });
    return NextResponse.json(r);
  } catch (err) {
    if (err instanceof MoveError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
