import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateTeamMember, deleteTeamMember } from "@/lib/team/data";

const ADMIN = ["super_admin", "admin"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(req);
    if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Admins only. Use My Profile to edit your own." }, { status: 403 });
    const { id } = await params;
    return NextResponse.json(await updateTeamMember(id, await req.json()));
  } catch (err) {
    const e = err as AuthError;
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(req);
    if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    const { id } = await params;
    await deleteTeamMember(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const e = err as AuthError;
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
