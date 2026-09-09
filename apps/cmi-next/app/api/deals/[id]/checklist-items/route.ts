// Custom per-deal completion items: list + create.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadChecklistItems, createChecklistItem } from "@/lib/deals/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await loadChecklistItems(id));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't add items.` }, { status: 403 });
    const { id } = await params;
    const body = await request.json() as { label: string; required?: boolean };
    if (!body.label?.trim()) return NextResponse.json({ error: "Item label is required." }, { status: 400 });
    return NextResponse.json({ item: await createChecklistItem(id, body, { id: staff.id }) }, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
