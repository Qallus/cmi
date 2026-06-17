import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Template not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("name" in body)          patch.name          = String(body.name ?? "");
    if ("subject" in body)       patch.subject       = String(body.subject ?? "");
    if ("preview_text" in body)  patch.preview_text  = String(body.preview_text ?? "");
    if ("builder_type" in body)  patch.builder_type  = body.builder_type === "visual" ? "visual" : "html";
    if ("blocks" in body)        patch.blocks        = Array.isArray(body.blocks) ? body.blocks : [];
    if ("html" in body)          patch.html          = String(body.html ?? "");
    if ("trigger_event" in body) patch.trigger_event = body.trigger_event ? String(body.trigger_event) : null;
    if ("status" in body)        patch.status        = body.status === "active" ? "active" : "draft";

    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Failed to update template." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { error } = await getSupabaseAdmin().from("email_templates").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Failed to delete template." }, { status: 400 });
  }
}
