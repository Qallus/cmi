// Update (toggle/rename) or delete a custom checklist item.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateChecklistItem, deleteChecklistItem } from "@/lib/deals/data";
import { canWriteDeals } from "@/lib/deals/roles";


export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { itemId } = await params;
    const body = await request.json() as { label?: string; done?: boolean };
    return NextResponse.json({ item: await updateChecklistItem(itemId, body, { id: staff.id }) });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { itemId } = await params;
    await deleteChecklistItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
