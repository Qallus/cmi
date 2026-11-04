// Field Reports: a job's daily logs, one per day (newest first), and adding a
// typed entry to a day from the review screen.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { appendToDayLog, fieldReportsOn, listDayLogs } from "@/lib/daily-logs/reports";
import { todayAZ } from "@/lib/schedules/progress";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    if (!(await fieldReportsOn())) return NextResponse.json({ enabled: false, reports: [] });
    const { id } = await params;
    const u = new URL(request.url);
    return NextResponse.json({ enabled: true, today: todayAZ(), reports: await listDayLogs(id, { from: u.searchParams.get("from") ?? undefined, to: u.searchParams.get("to") ?? undefined }) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

// POST { date?, notes, dictated? }: type or paste into a day's log (sorted into sections).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't add to daily logs." }, { status: 403 });
    if (!(await fieldReportsOn())) return NextResponse.json({ error: "Field Reports is switched off." }, { status: 403 });
    const { id } = await params;
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : todayAZ();
    const notes = typeof b.notes === "string" ? b.notes.slice(0, 20_000) : "";
    if (!notes.trim()) return NextResponse.json({ error: "Type or dictate something first." }, { status: 400 });
    const log = await appendToDayLog(id, date, { notes, dictated: b.dictated === true }, { id: staff.id, email: user.email ?? null, name: staff.display_name ?? null });
    return NextResponse.json({ log }, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
