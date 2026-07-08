// Create a new job from a template. Body: { template_id, ...input }.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { createJobFromTemplate, JobError } from "@/lib/jobs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create jobs.` }, { status: 403 });
    const body = await request.json().catch(() => null) as { template_id?: string; job_name?: string } & Record<string, unknown> | null;
    if (!body?.template_id) return NextResponse.json({ error: "Missing template_id." }, { status: 400 });
    if (!body?.job_name) return NextResponse.json({ error: "Job name is required." }, { status: 400 });
    const { template_id, ...input } = body;
    const job = await createJobFromTemplate(template_id, input as never, { name: user.email, id: staff.id });
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    if (err instanceof JobError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
