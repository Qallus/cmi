// Daily logs from the all-jobs page: one log, filed against one or more Jobs
// and/or Pre-Con opportunities (one row each).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { createDailyLogs, type LogTarget } from "@/lib/daily-logs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't add daily logs." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown> & { targets?: LogTarget[] };
    const targets = (Array.isArray(body.targets) ? body.targets : [])
      .filter((t) => t && (t.kind === "job" || t.kind === "opportunity") && typeof t.id === "string");
    if (!targets.length) return NextResponse.json({ error: "Choose at least one Job or Pre-Con." }, { status: 400 });
    const { targets: _t, ...draft } = body;
    void _t;
    const logDate = typeof draft.log_date === "string" && draft.log_date ? draft.log_date : new Date().toISOString().slice(0, 10);
    const logs = await createDailyLogs(targets, { ...draft, log_date: logDate }, user.email);
    return NextResponse.json({ logs }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save the log." }, { status: 500 });
  }
}
