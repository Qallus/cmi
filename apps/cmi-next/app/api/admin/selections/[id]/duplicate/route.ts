import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { duplicateSelection } from "@/lib/selections/duplicate";

// Duplicate a library/global selection so it can be modified independently.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const copy = await duplicateSelection(id, { created_by: staff.id });
    return NextResponse.json({ selection: copy }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to duplicate selection." }, { status: 400 });
  }
}
