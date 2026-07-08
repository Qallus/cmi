import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateInvoice, deleteInvoice } from "@/lib/invoices/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; invId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { invId } = await params;
    const body = await request.json();
    // Line items are optional on update; only replace them when provided.
    const { line_items, ...patch } = body ?? {};
    return NextResponse.json(await updateInvoice(invId, patch, line_items));
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; invId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { invId } = await params;
    await deleteInvoice(invId);
    return new NextResponse(null, { status: 204 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
