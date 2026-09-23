import { NextRequest, NextResponse } from "next/server";
import { updateQuote, deleteQuote } from "@/lib/quotes/data";
import { denyUnlessStaff } from "@/lib/auth/guard";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try {
    const { id } = await params;
    return NextResponse.json(await updateQuote(id, await req.json()));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try {
    const { id } = await params;
    await deleteQuote(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
