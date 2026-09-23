// Update or remove a single deal task (mark complete, reassign, reschedule).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateDealTask, deleteDealTask } from "@/lib/deals/data";
import { canWriteDeals } from "@/lib/deals/roles";


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't delete tasks.` }, { status: 403 });
    }
    const { id } = await params;
    await deleteDealTask(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
