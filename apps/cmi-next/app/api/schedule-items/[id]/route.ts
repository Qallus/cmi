import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { updateItem, deleteItem } from "@/lib/schedules/data";
import { inspectionsEnabled } from "@/lib/inspections/data";
import { holdPointsBefore } from "@/lib/inspections/status-data";
import { startsWork } from "@/lib/inspections/status";

// PATCH a schedule item. Pass `cascade: false` to skip downstream recalculation.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { cascade, ...patch } = body as Record<string, unknown>;
    const result = await updateItem(id, patch, { id: staff.id }, { cascade: cascade !== false });
    // Hold points: starting work that an inspection holds, before it has passed, saves but warns.
    const holdPoints = startsWork(patch) && (await inspectionsEnabled()) ? await holdPointsBefore(id) : [];
    return NextResponse.json({ ...result, holdPoints });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    await deleteItem(id, { id: staff.id });
    return NextResponse.json({ ok: true });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
