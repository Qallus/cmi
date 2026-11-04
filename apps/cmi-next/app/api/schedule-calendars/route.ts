import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canManageSchedules, canViewSchedules } from "@/lib/schedules/permissions";
import { isFeatureEnabled } from "@/lib/flags";
import { ENGINE_FLAG } from "@/lib/schedules/engine";
import { getCalendar, inheritedFor, saveCalendar, type CalendarScope } from "@/lib/schedules/calendars-data";

const SCOPES: CalendarScope[] = ["company", "job", "schedule"];
const isCompanyAdmin = (role: string | null | undefined) => role === "super_admin" || role === "admin";

function parse(request: Request) {
  const u = new URL(request.url);
  const scope = u.searchParams.get("scope") as CalendarScope;
  const id = u.searchParams.get("id");
  if (!SCOPES.includes(scope)) throw Object.assign(new Error("scope must be company, job or schedule."), { status: 400 });
  if (scope !== "company" && !id) throw Object.assign(new Error("id is required."), { status: 400 });
  return { scope, id: scope === "company" ? null : id };
}

// GET ?scope=company | job&id= | schedule&id=: the stored calendar and what it inherits.
export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await isFeatureEnabled(ENGINE_FLAG))) return NextResponse.json({ error: "The schedule engine is switched off." }, { status: 403 });
    const { scope, id } = parse(request);
    const [calendar, inherited] = await Promise.all([getCalendar(scope, id), inheritedFor(scope)]);
    const canEdit = scope === "company" ? isCompanyAdmin(staff.role_slug) : canManageSchedules(staff.role_slug);
    return NextResponse.json({ calendar, inherited, canEdit });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

// PUT ?scope=…&id=… { workdays: {mon…sun} | null (inherit), exceptions: [...] }
// Saves and recalculates the critical-path schedules that use it.
export async function PUT(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!(await isFeatureEnabled(ENGINE_FLAG))) return NextResponse.json({ error: "The schedule engine is switched off." }, { status: 403 });
    const { scope, id } = parse(request);
    const allowed = scope === "company" ? isCompanyAdmin(staff.role_slug) : canManageSchedules(staff.role_slug);
    if (!allowed) return NextResponse.json({ error: scope === "company" ? "Only Admins change the company calendar." : "Only Admins and Project Managers change a job's calendar." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    try {
      return NextResponse.json(await saveCalendar(scope, id, body, { id: staff.id }));
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save the calendar." }, { status: 400 });
    }
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
