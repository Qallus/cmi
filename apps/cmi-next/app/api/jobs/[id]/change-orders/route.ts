import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadChangeOrders, createChangeOrder } from "@/lib/change-orders/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadChangeOrders(id));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    if (!body?.title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    return NextResponse.json(await createChangeOrder(id, body, user.email), { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
