// Copy a deal as a fresh lead (same client and scope, new pipeline entry).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWriteDeals } from "@/lib/deals/roles";
import { duplicateDeal } from "@/lib/deals/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff, user } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create deals.` }, { status: 403 });
    }
    const { id } = await params;
    const copy = await duplicateDeal(id, { id: staff.id, name: user.email });
    return NextResponse.json(copy, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
