// Daily logs from the all-jobs page: one log, filed against one or more Jobs
// and/or Pre-Con opportunities (one row each).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { createDailyLogs, type LogTarget } from "@/lib/daily-logs/data";
import { sanitizeHtmlServer } from "@/lib/html/sanitize-server";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't add daily logs." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown> & { targets?: LogTarget[] };
    const targets = (Array.isArray(body.targets) ? body.targets : [])
      .filter((t) => t && (t.kind === "job" || t.kind === "opportunity" || t.kind === "deal") && typeof t.id === "string");
    if (!targets.length) return NextResponse.json({ error: "Choose a Pipeline deal, Pre-Con or Job." }, { status: 400 });
    const { targets: _t, ...draft } = body;
    void _t;
    // The date is set here (Phoenix), not by the form; an explicit date is
    // still accepted from older callers (camera / voice capture).
    const logDate = typeof draft.log_date === "string" && draft.log_date ? draft.log_date : new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
    const visibility = draft.visibility === "private" ? "private" : "team";
    const notes = typeof draft.notes === "string" ? sanitizeHtmlServer(draft.notes) || null : null;
    const logs = await createDailyLogs(targets, {
      ...draft, notes, log_date: logDate, visibility, include_in_brief: !!draft.include_in_brief,
    }, user.email, staff.id);
    return NextResponse.json({ logs }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save the log." }, { status: 500 });
  }
}
