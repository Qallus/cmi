import { NextRequest, NextResponse } from "next/server";
import { loadTeamMembers, createTeamMember } from "@/lib/team/data";

export async function GET() {
  try { return NextResponse.json(await loadTeamMembers()); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try { return NextResponse.json(await createTeamMember(await req.json()), { status: 201 }); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 }); }
}
