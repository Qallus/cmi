// Deals collection: list + create. Writes gated to sales/ops roles.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadDeals, createDeal } from "@/lib/deals/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await loadDeals());
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create deals.` }, { status: 403 });
    }
    const body = await request.json();
    if (!body?.title) return NextResponse.json({ error: "Deal title is required." }, { status: 400 });
    const created = await createDeal(body, { name: user.email, id: staff.id });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
