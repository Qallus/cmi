// Jobs collection: list + create. Creating a job mints its YY_###_Name number.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadJobList, createJob, JobError } from "@/lib/jobs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const rows = await loadJobList({
      includeTemplates: url.searchParams.get("templates") === "1",
      includeArchived: url.searchParams.get("archived") === "1",
    });
    return NextResponse.json(rows);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create jobs.` }, { status: 403 });
    }
    const body = await request.json();
    if (!body?.job_name?.trim()) return NextResponse.json({ error: "Job name is required." }, { status: 400 });
    const job = await createJob(body, { name: user.email, id: staff.id });
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    if (err instanceof JobError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
