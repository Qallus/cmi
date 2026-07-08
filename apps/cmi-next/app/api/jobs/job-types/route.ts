import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJobTypes, createJobType, JobError } from "@/lib/jobs/data";

const ADMIN = ["super_admin", "admin"];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await loadJobTypes());
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    if (!ADMIN.includes(staff.role_slug)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    return NextResponse.json(await createJobType(await request.json()), { status: 201 });
  } catch (err) {
    if (err instanceof JobError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
