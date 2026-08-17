import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canViewSchedules, canEditSchedules } from "@/lib/schedules/permissions";
import { listDependencies, createDependency } from "@/lib/schedules/data";

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canViewSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId") ?? undefined;
    const scheduleId = url.searchParams.get("scheduleId") ?? undefined;
    return NextResponse.json(await listDependencies({ jobId, scheduleId }));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canEditSchedules(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (!body.sourceItemId || !body.targetItemId) return NextResponse.json({ error: "Source and target are required." }, { status: 400 });
    if (body.sourceItemId === body.targetItemId) return NextResponse.json({ error: "An item cannot depend on itself." }, { status: 400 });
    const dep = await createDependency(body, { id: staff.id });
    return NextResponse.json(dep, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
