import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { inspectionsEnabled } from "@/lib/inspections/data";
import { inspectionInfo, setInspectionStatus } from "@/lib/inspections/status-data";

const off = () => NextResponse.json({ error: "Inspection milestones are turned off." }, { status: 404 });

/** An inspection milestone's status, hold point, request rule and request-by date. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await inspectionsEnabled())) return off();
    const { id } = await params;
    return NextResponse.json(await inspectionInfo(id, staff.role_slug));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

/** Body: { status, date?, note? }. Who may: Settings → Scheduling → Inspections. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!(await inspectionsEnabled())) return off();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await setInspectionStatus(id, {
      status: String(body.status ?? ""), date: typeof body.date === "string" && body.date ? body.date : null,
      note: typeof body.note === "string" ? body.note : null,
    }, { id: staff.id, name: staff.display_name ?? null, role: staff.role_slug ?? null });
    return NextResponse.json({ ok: true, ...result, info: await inspectionInfo(id, staff.role_slug) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
