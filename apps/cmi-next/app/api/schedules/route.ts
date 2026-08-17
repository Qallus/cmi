import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { listAllSchedules, dashboardMetrics } from "@/lib/schedules/data";

// GET: global schedules list + dashboard metrics (for /dashboard/schedules).
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("archived") === "1";
    const [schedules, metrics] = await Promise.all([listAllSchedules({ includeArchived }), dashboardMetrics()]);
    return NextResponse.json({ schedules, metrics });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
