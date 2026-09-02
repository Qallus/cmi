// Activity (touch log) feed for a deal: list + create (optionally spawning the
// next task in the same submit).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadActivities, logActivity } from "@/lib/deals/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadActivities({ dealId: id }));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't log activities.` }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (!body?.type) return NextResponse.json({ error: "Activity type is required." }, { status: 400 });

    const result = await logActivity(
      { ...body, deal_id: id },
      { name: user.email, id: staff.id },
      body.next_task ?? null,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
