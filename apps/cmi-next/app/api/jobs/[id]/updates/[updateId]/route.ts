import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateJobUpdate, deleteJobUpdate } from "@/lib/job-updates/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; updateId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { updateId } = await params;
    return NextResponse.json(await updateJobUpdate(updateId, await request.json()));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; updateId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { updateId } = await params;
    await deleteJobUpdate(updateId);
    return new NextResponse(null, { status: 204 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
