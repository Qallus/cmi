import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canManageSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { captureBaseline, listBaselines } from "@/lib/schedules/data";

// GET: the schedule's baselines, newest first (the newest is the current one
// variance reads against; the Gantt can show any earlier one).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const rows = await listBaselines(id);
    return NextResponse.json({ baselines: rows.map((b) => ({ id: b.id, number: b.number ?? null, name: b.name, reason: b.reason, locked: !!b.locked, created_at: b.created_at, snapshot: b.snapshot })) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

// POST: capture an immutable baseline snapshot of the schedule's item dates.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canManageSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const baseline = await captureBaseline(id, body.name ?? "Baseline", body.reason ?? null, { id: staff.id });
    return NextResponse.json(baseline, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
