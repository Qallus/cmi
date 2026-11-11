import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { selectionOnJob } from "@/lib/job-selections/data";
import { addStaffReply, listComments, CommentsError } from "@/lib/selection-comments/data";

// The client ↔ team thread on a job's selection. Any staff member can read it;
// the roles that can edit selections can reply (the reply shows in the client's portal).
const WRITE_ROLES = ["super_admin", "admin", "project_manager", "designer"];

type Ctx = { params: Promise<{ id: string; selId: string }> };

function fail(err: unknown) {
  if (err instanceof CommentsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const e = err as AuthError;
  return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
}

export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireAdmin(request);
    const { id, selId } = await params;
    if (!(await selectionOnJob(selId, id))) return NextResponse.json({ error: "Selection not found on this job." }, { status: 404 });
    return NextResponse.json(await listComments(selId, id));
  } catch (err) { return fail(err); }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't reply to clients." }, { status: 403 });
    const { id, selId } = await params;
    if (!(await selectionOnJob(selId, id))) return NextResponse.json({ error: "Selection not found on this job." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const name = (staff as { display_name?: string | null }).display_name || "CMI team";
    return NextResponse.json(await addStaffReply(selId, id, { id: staff.id, name }, String(body.body ?? "")), { status: 201 });
  } catch (err) { return fail(err); }
}
