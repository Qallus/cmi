import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { inspectionsEnabled } from "@/lib/inspections/data";
import { applyInspections, candidatesForSchedule } from "@/lib/inspections/apply";

const off = () => NextResponse.json({ error: "Inspection milestones are turned off." }, { status: 404 });

/** The library rows this job's jurisdiction and scope allow, for the Add inspections dialog. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await inspectionsEnabled())) return off();
    const { id } = await params;
    return NextResponse.json(await candidatesForSchedule(id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

/** Body: { picks: [{ step_id: "SCOT-M07", count?: 3 }] }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await inspectionsEnabled())) return off();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const picks = Array.isArray(body.picks) ? body.picks.map((p: { step_id?: unknown; count?: unknown }) => ({
      step_id: String(p?.step_id ?? ""), count: Number.isFinite(Number(p?.count)) ? Number(p.count) : 1,
    })) : [];
    const result = await applyInspections(id, picks, { id: staff.id, name: staff.display_name ?? null });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
