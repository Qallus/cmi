import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { deleteDailyLog, getJobLogFor } from "@/lib/daily-logs/data";
import { cleanEdit, editDailyLog } from "@/lib/daily-logs/edit";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id, logId } = await params;
    // Only a log on this job, and only the author's when it's private.
    if (!(await getJobLogFor(id, logId, staff.id))) return NextResponse.json({ error: "Daily log not found." }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    // The full editor: text, photos and attachments (add / remove), who sees it,
    // and moving the log to another job.
    const result = await editDailyLog(logId, cleanEdit(body), { id: staff.id, email: user.email ?? null, name: staff.display_name ?? null });
    return NextResponse.json({ ...result.log, moved_to: result.movedTo ?? null, merged: !!result.merged });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id, logId } = await params;
    if (!(await getJobLogFor(id, logId, staff.id))) return NextResponse.json({ error: "Daily log not found." }, { status: 404 });
    await deleteDailyLog(logId);
    return new NextResponse(null, { status: 204 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
