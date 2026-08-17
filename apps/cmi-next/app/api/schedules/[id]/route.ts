import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules, canEditSchedules, canManageSchedules } from "@/lib/schedules/permissions";
import {
  getSchedule, updateSchedule, deleteSchedule, listPhases, listItems,
  listDependencies, listParticipants, listBaselines, listActivity,
} from "@/lib/schedules/data";

// GET: full schedule bundle (schedule + phases + items + deps + participants + baselines + activity).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const schedule = await getSchedule(id);
    if (!schedule) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const [phases, items, dependencies, participants, baselines, activity] = await Promise.all([
      listPhases(id), listItems({ scheduleId: id }), listDependencies({ scheduleId: id }),
      listParticipants(id), listBaselines(id), listActivity({ scheduleId: id, limit: 60 }),
    ]);
    return NextResponse.json({ schedule, phases, items, dependencies, participants, baselines, activity });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const schedule = await updateSchedule(id, body, { id: staff.id });
    return NextResponse.json(schedule);
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canManageSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    await deleteSchedule(id, { id: staff.id });
    return NextResponse.json({ ok: true });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
