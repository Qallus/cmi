import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { ENGINE_FLAG, loadNetwork } from "@/lib/schedules/engine";

// GET: the schedule's whole network (every schedule its tasks can link to, the
// links and the work calendars) so the what-if sandbox can recalculate in the
// browser. Read-only.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled(ENGINE_FLAG))) return NextResponse.json({ error: "The schedule engine is switched off." }, { status: 403 });
    const { id } = await params;
    const { jobId: _jobId, ...net } = await loadNetwork(id);
    return NextResponse.json({ network: net });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
