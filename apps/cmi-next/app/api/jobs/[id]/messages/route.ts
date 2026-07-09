// Staff view + reply on a job's client message thread.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyJobClients } from "@/lib/client-portal/notifications";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator", "superintendent"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin().from("job_messages").select("*").eq("job_id", id).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    // Mark unread client messages as read now that staff has viewed the thread.
    await getSupabaseAdmin().from("job_messages").update({ read_at: new Date().toISOString() }).eq("job_id", id).eq("sender_type", "client").is("read_at", null);
    return NextResponse.json(data ?? []);
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const { body, visibility, category } = await request.json() as { body?: string; visibility?: string; category?: string };
    if (!body?.trim()) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("job_messages").insert({
      job_id: id, sender_type: "staff", sender_id: staff.id, sender_name: user.email,
      body: body.trim(), category: category ?? "general", visibility: visibility === "internal" ? "internal" : "client_visible",
    }).select().single();
    if (error) throw new Error(error.message);
    // Notify clients only for client-visible replies.
    if (data.visibility === "client_visible") {
      notifyJobClients(id, { type: "message", title: "New message from your team", body: body.trim().slice(0, 140), link: `/client/jobs/${id}/messages` }).catch(() => {});
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
