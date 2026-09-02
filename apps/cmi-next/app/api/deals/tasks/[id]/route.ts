// Update a single deal task (e.g. mark complete, reassign, reschedule).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateDealTask } from "@/lib/deals/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't edit tasks.` }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await updateDealTask(id, body));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
