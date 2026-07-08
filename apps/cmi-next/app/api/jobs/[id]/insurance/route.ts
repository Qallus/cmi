import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { upsertJobInsurance, JobError } from "@/lib/jobs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    return NextResponse.json(await upsertJobInsurance(id, await request.json()));
  } catch (err) {
    if (err instanceof JobError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
