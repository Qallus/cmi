import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { deleteJobFile } from "@/lib/job-files/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { fileId } = await params;
    await deleteJobFile(fileId);
    return new NextResponse(null, { status: 204 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
