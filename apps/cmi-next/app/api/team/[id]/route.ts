import { NextRequest, NextResponse } from "next/server";
import { updateTeamMember, deleteTeamMember } from "@/lib/team/data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json(await updateTeamMember(id, await req.json())); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await deleteTeamMember(id); return new NextResponse(null, { status: 204 }); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}
