import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { attachSelectionsToJob, listAttachableSelections } from "@/lib/job-selections/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "designer"];

// GET: the Selection Library available to attach to this job.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ selections: await listAttachableSelections() });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// POST { selection_ids }: attach existing selections to this job (reusable).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = (await request.json()) as { selection_ids?: string[] };
    const ids = (body.selection_ids ?? []).filter(Boolean);
    if (!ids.length) return NextResponse.json({ error: "No selections chosen." }, { status: 400 });
    const attached = await attachSelectionsToJob(id, ids, staff.id ?? null);
    return NextResponse.json({ attached });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
