import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { deleteDependency, updateDependencyLook } from "@/lib/schedules/data";

// PATCH: a link's look on the Gantt ({ line_color, line_style }); dates are untouched.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const dependency = await updateDependencyLook(id, body);
    return NextResponse.json({ dependency });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? (e instanceof AuthError ? 500 : 400) });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    await deleteDependency(id, { id: staff.id });
    return NextResponse.json({ ok: true });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
