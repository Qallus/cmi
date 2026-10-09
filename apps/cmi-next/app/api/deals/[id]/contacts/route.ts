// People on a deal: list + add.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWriteDeals } from "@/lib/deals/roles";
import { addDealContact, listDealContacts, DealContactError } from "@/lib/deals/contacts";

function fail(err: unknown) {
  if (err instanceof AuthError || err instanceof DealContactError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await listDealContacts(id));
  } catch (err) { return fail(err); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!canWriteDeals(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't edit deals.` }, { status: 403 });
    const { id } = await params;
    return NextResponse.json(await addDealContact(id, await request.json()), { status: 201 });
  } catch (err) { return fail(err); }
}
