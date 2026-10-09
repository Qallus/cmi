// One person on a deal: edit their details / role / primary, or take them off.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWriteDeals } from "@/lib/deals/roles";
import { removeDealContact, updateDealContact, DealContactError } from "@/lib/deals/contacts";

function fail(err: unknown) {
  if (err instanceof AuthError || err instanceof DealContactError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
}

async function guard(request: Request) {
  const { staff } = await requireAdmin(request);
  if (!canWriteDeals(staff.role_slug)) throw new DealContactError(`Your role (${staff.role_slug}) can't edit deals.`, 403);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  try {
    await guard(request);
    const { id, linkId } = await params;
    return NextResponse.json(await updateDealContact(id, linkId, await request.json()));
  } catch (err) { return fail(err); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  try {
    await guard(request);
    const { id, linkId } = await params;
    return NextResponse.json(await removeDealContact(id, linkId));
  } catch (err) { return fail(err); }
}
