import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { PROGRESS_FLAG } from "@/lib/schedules/engine";
import { loadHealth } from "@/lib/schedules/health-data";

// GET: the schedule's health tiles (Phase 2 Step 5), each with the tasks behind it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled(PROGRESS_FLAG))) return NextResponse.json({ error: "Progress tracking is switched off." }, { status: 403 });
    const { id } = await params;
    return NextResponse.json(await loadHealth(id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
