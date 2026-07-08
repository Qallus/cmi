import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadDailyLogs, createDailyLog } from "@/lib/daily-logs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadDailyLogs(id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    if (!body?.log_date) body.log_date = new Date().toISOString().slice(0, 10);
    return NextResponse.json(await createDailyLog(id, body, user.email), { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
