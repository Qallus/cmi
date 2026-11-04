import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadDailyLogs, createDailyLog } from "@/lib/daily-logs/data";
import { sanitizeHtmlServer } from "@/lib/html/sanitize-server";
import { todayAZ } from "@/lib/schedules/progress";
import type { DailyLogDraft } from "@/lib/daily-logs/types";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadDailyLogs(id, staff.id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

// POST: a log on this job. Only the log's own fields are accepted (never ids,
// authorship or another job), and the author is the signed-in staff member.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const date = str(b.log_date);
    const visibility = b.visibility === "private" ? "private" : "team";
    const draft: DailyLogDraft = {
      log_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayAZ(),
      notes: typeof b.notes === "string" ? sanitizeHtmlServer(b.notes) || null : null,
      weather: str(b.weather) ?? null,
      temperature: str(b.temperature) ?? null,
      hours_worked: typeof b.hours_worked === "number" ? b.hours_worked : null,
      crew: Array.isArray(b.crew) ? b.crew.filter((c): c is string => typeof c === "string") : null,
      visitors: str(b.visitors) ?? null,
      delays: str(b.delays) ?? null,
      photos: Array.isArray(b.photos) ? b.photos.filter((p): p is string => typeof p === "string") : [],
      visibility,
      include_in_brief: b.include_in_brief === true,
      client_visible: b.client_visible === true && visibility !== "private",
      created_by_id: staff.id,
    };
    if (typeof b.title === "string") draft.title = b.title.slice(0, 200);
    return NextResponse.json(await createDailyLog(id, draft, user.email), { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
