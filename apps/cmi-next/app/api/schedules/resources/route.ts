import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { PROGRESS_FLAG } from "@/lib/schedules/engine";
import { loadResourceView, resourcePool } from "@/lib/schedules/resources-data";
import { todayAZ } from "@/lib/schedules/progress";

// Resources (Phase 2 Step 7, flag schedule_progress).
// GET ?pool=1&q=…            the picker: staff, trade partners, trade labels
// GET ?from=YYYY-MM-DD&weeks=N  the cross-job view: weeks across, one row per resource
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const url = new URL(request.url);
    if (url.searchParams.get("pool")) return NextResponse.json({ pool: await resourcePool(url.searchParams.get("q") ?? "") });
    if (!(await isFeatureEnabled(PROGRESS_FLAG))) return NextResponse.json({ error: "Progress tracking is switched off." }, { status: 403 });
    const fromQ = url.searchParams.get("from");
    const from = fromQ && /^\d{4}-\d{2}-\d{2}$/.test(fromQ) ? fromQ : todayAZ();
    const weeks = Math.max(1, Math.min(26, Number(url.searchParams.get("weeks")) || 8));
    return NextResponse.json({ from, weeks, ...(await loadResourceView(from, weeks)) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
