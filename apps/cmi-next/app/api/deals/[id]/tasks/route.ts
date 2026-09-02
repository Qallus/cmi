// Tasks for a deal: list + create.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadDealTasks, createDealTask } from "@/lib/deals/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadDealTasks({ dealId: id }));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create tasks.` }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (!body?.title) return NextResponse.json({ error: "Task title is required." }, { status: 400 });
    const task = await createDealTask({ ...body, deal_id: id }, { id: staff.id });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
