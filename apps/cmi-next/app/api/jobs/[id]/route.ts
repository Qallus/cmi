// Single job: get (with relations), update, archive (soft delete).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getJob, updateJob, archiveJob, JobError, JobConflictError } from "@/lib/jobs/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager"];
const ARCHIVE_ROLES = ["super_admin", "admin"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    return NextResponse.json(job);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't edit jobs.` }, { status: 403 });
    const { id } = await params;
    const { base_updated_at, ...patch } = (await request.json()) as Record<string, unknown> & { base_updated_at?: string };
    const job = await updateJob(id, patch, { name: user.email, id: staff.id }, { expectedUpdatedAt: base_updated_at ?? null });
    return NextResponse.json(job);
  } catch (err) {
    if (err instanceof JobConflictError) {
      return NextResponse.json({ error: err.message, code: "CONFLICT", current: err.current }, { status: 409 });
    }
    if (err instanceof JobError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!ARCHIVE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: `Your role (${staff.role_slug}) can't archive jobs.` }, { status: 403 });
    const { id } = await params;
    await archiveJob(id, { name: user.email, id: staff.id });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
