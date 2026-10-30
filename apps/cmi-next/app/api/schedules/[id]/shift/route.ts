import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canEditSchedules } from "@/lib/schedules/permissions";
import { shiftSchedule } from "@/lib/schedules/data";

// POST: move a whole schedule to a new start date (same working-day spacing).
// { startDate, includeComplete?, dryRun? } — dryRun returns the plan only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.startDate !== "string" || !body.startDate) return NextResponse.json({ error: "startDate is required." }, { status: 400 });
    const result = await shiftSchedule(id, body.startDate, { id: staff.id }, { includeComplete: body.includeComplete === true, dryRun: body.dryRun === true });
    return NextResponse.json(result);
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
