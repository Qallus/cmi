// Add items to a punch list: { items: [{ title, notes?, location?, trade?, priority?, assigned_to?, due_date? }] }.
import { NextResponse } from "next/server";
import { addItems } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await punchSession(request, true);
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    return NextResponse.json(await addItems((await params).id, items, actor), { status: 201 });
  } catch (err) {
    return punchError(err);
  }
}
