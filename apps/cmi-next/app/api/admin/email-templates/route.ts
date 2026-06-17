import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .select("id, name, subject, builder_type, trigger_event, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ templates: data ?? [] });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Failed to load templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const { data, error } = await getSupabaseAdmin()
      .from("email_templates")
      .insert({
        name: String(body.name ?? "Untitled Template"),
        subject: String(body.subject ?? ""),
        preview_text: String(body.preview_text ?? ""),
        builder_type: body.builder_type === "visual" ? "visual" : "html",
        blocks: Array.isArray(body.blocks) ? body.blocks : [],
        html: String(body.html ?? ""),
        trigger_event: body.trigger_event ? String(body.trigger_event) : null,
        status: body.status === "active" ? "active" : "draft",
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Failed to create template." }, { status: 400 });
  }
}
