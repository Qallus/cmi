// Single deal: fetch, update, delete.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getDeal, updateDeal, deleteDeal } from "@/lib/deals/data";
import { canWriteDeals } from "@/lib/deals/roles";


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const deal = await getDeal(id);
    if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    return NextResponse.json(deal);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't edit deals.` }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await updateDeal(id, body, { id: staff.id }));
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// Permanent removal, for duplicates and test entries. Everyday "get it off the
// board" is POST /archive, which keeps the record.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (staff.role_slug !== "super_admin") {
      return NextResponse.json({ error: "Only a Super Admin can permanently delete a deal. Archive it instead." }, { status: 403 });
    }
    const { id } = await params;
    await deleteDeal(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
