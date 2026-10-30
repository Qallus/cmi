import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules, canEditSchedules } from "@/lib/schedules/permissions";
import { listScopeSchedules, createScopeSchedule, scopeScheduleHeader, scopeLabel } from "@/lib/schedules/data";
import { readScope } from "../../scope";

// The schedules of a job, Pipeline deal, Pre-Con record or selection.
// GET: schedules + header rollup. POST: create one (optionally inside another).
export async function GET(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const r = await readScope(params);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
    const [schedules, header, label] = await Promise.all([listScopeSchedules(r.scope, { includeArchived }), scopeScheduleHeader(r.scope), scopeLabel(r.scope)]);
    return NextResponse.json({ schedules, header, label });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const r = await readScope(params);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const body = await request.json().catch(() => ({}));
    const schedule = await createScopeSchedule(r.scope, body, { id: staff.id });
    return NextResponse.json(schedule, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
