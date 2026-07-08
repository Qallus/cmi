// Promote an Opportunity into a Job. Body: { opportunity_id, overrides? }.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { convertOpportunityToJob, JobError } from "@/lib/jobs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create jobs.` }, { status: 403 });
    const body = await request.json().catch(() => null) as { opportunity_id?: string; overrides?: Record<string, unknown> } | null;
    if (!body?.opportunity_id) return NextResponse.json({ error: "Missing opportunity_id." }, { status: 400 });
    const job = await convertOpportunityToJob(body.opportunity_id, (body.overrides ?? {}) as never, { name: user.email, id: staff.id });
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    if (err instanceof JobError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
