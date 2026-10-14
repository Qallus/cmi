import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateDailyLog, deleteDailyLog, autoTitle } from "@/lib/daily-logs/data";
import { sanitizeHtmlServer } from "@/lib/html/sanitize-server";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { logId } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (typeof body.notes === "string") { patch.notes = sanitizeHtmlServer(body.notes) || null; patch.title = autoTitle({ notes: patch.notes as string | null }); }
    if (body.visibility === "private" || body.visibility === "team") patch.visibility = body.visibility;
    if (typeof body.include_in_brief === "boolean") patch.include_in_brief = body.include_in_brief;
    if (typeof body.client_visible === "boolean") patch.client_visible = body.client_visible && patch.visibility !== "private";
    return NextResponse.json(await updateDailyLog(logId, patch));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { logId } = await params;
    await deleteDailyLog(logId);
    return new NextResponse(null, { status: 204 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
