// Staff: list a job's warranty requests + triage (status/assignment/resolution).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyClient } from "@/lib/client-portal/notifications";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin().from("warranty_requests").select("*").eq("job_id", id).order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await params;
    const body = await request.json() as { requestId?: string } & Record<string, unknown>;
    const { requestId, ...patch } = body;
    if (!requestId) return NextResponse.json({ error: "Missing requestId." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("warranty_requests")
      .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", requestId).select().single();
    if (error) throw new Error(error.message);
    // Notify the submitting client when the status changes.
    if (patch.status && data.contact_id) {
      notifyClient(data.contact_id, data.job_id, { type: "warranty", title: `Warranty update: ${data.request_title}`, body: `Status: ${String(patch.status).replace(/_/g, " ")}`, link: data.job_id ? `/client/jobs/${data.job_id}/warranty` : null }).catch(() => {});
    }
    return NextResponse.json(data);
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
