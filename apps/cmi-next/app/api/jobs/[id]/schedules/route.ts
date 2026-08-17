import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules, canEditSchedules } from "@/lib/schedules/permissions";
import { listSchedules, createSchedule, jobScheduleHeader } from "@/lib/schedules/data";

// GET: this job's schedules + header rollup. POST: create a schedule for the job.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("archived") === "1";
    const [schedules, header] = await Promise.all([listSchedules(id, { includeArchived }), jobScheduleHeader(id)]);
    return NextResponse.json({ schedules, header });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const schedule = await createSchedule(id, body, { id: staff.id });
    return NextResponse.json(schedule, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
