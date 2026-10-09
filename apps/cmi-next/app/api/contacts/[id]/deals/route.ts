// The Pipeline deals a contact is on (any stage), for the Contacts page.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { listDealsForContact, DealContactError } from "@/lib/deals/contacts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await listDealsForContact(id));
  } catch (err) {
    if (err instanceof AuthError || err instanceof DealContactError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load deals." }, { status: 500 });
  }
}
