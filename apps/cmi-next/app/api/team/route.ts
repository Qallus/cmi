import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadTeamMembers, createTeamMember } from "@/lib/team/data";

const ADMIN = ["super_admin", "admin"];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req); // any active staff may read the team list
    return NextResponse.json(await loadTeamMembers());
  } catch (err) {
    const e = err as AuthError;
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { staff } = await requireAdmin(req);
    if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    return NextResponse.json(await createTeamMember(await req.json()), { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
