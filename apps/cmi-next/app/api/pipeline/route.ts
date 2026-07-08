// Pipeline opportunities collection: list + create.
// Writes are gated to sales/ops roles; a create here mints a job number.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadOpportunities, createOpportunity } from "@/lib/pipeline/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await loadOpportunities());
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create opportunities.` }, { status: 403 });
    }
    const body = await request.json();
    if (!body?.opportunity_name) {
      return NextResponse.json({ error: "Opportunity name is required." }, { status: 400 });
    }
    const created = await createOpportunity(body, { name: user.email, id: staff.id });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
