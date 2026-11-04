// One field report: its edits after Submit (GET), edits (PATCH sections /
// weather) and Submit / Reopen (POST { action }).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { dayLogChanges, fieldReportsOn, reopenDayLog, submitDayLog, updateDayLog } from "@/lib/daily-logs/reports";
import { getJobLogFor } from "@/lib/daily-logs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];
const REOPEN_ROLES = ["super_admin", "admin", "project_manager"];

async function guard(request: Request, params: Promise<{ id: string; logId: string }>, roles?: string[]) {
  const { user, staff } = await requireAdmin(request);
  if (roles && !roles.includes(staff.role_slug)) return { error: NextResponse.json({ error: "Your role can't change this daily log." }, { status: 403 }) };
  if (!(await fieldReportsOn())) return { error: NextResponse.json({ error: "Field Reports is switched off." }, { status: 403 }) };
  const { id, logId } = await params;
  if (!(await getJobLogFor(id, logId, staff.id))) return { error: NextResponse.json({ error: "Daily log not found." }, { status: 404 }) };
  return { logId, actor: { id: staff.id, email: user.email ?? null, name: staff.display_name ?? null }, role: staff.role_slug };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const g = await guard(request, params);
    if ("error" in g) return g.error;
    return NextResponse.json({ changes: await dayLogChanges(g.logId) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const g = await guard(request, params, WRITE_ROLES);
    if ("error" in g) return g.error;
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Parameters<typeof updateDayLog>[1] = {};
    if (b.sections !== undefined) patch.sections = b.sections;
    if (typeof b.weather === "string" || b.weather === null) patch.weather = (b.weather as string | null)?.slice(0, 120) ?? null;
    if (typeof b.temperature === "string" || b.temperature === null) patch.temperature = (b.temperature as string | null)?.slice(0, 40) ?? null;
    return NextResponse.json({ log: await updateDayLog(g.logId, patch, g.actor) });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const b = (await request.clone().json().catch(() => ({}))) as { action?: string };
    const g = await guard(request, params, b.action === "reopen" ? REOPEN_ROLES : WRITE_ROLES);
    if ("error" in g) return g.error;
    if (b.action === "submit") return NextResponse.json(await submitDayLog(g.logId, g.actor));
    if (b.action === "reopen") return NextResponse.json({ log: await reopenDayLog(g.logId, g.actor) });
    return NextResponse.json({ error: "action must be submit or reopen." }, { status: 400 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
