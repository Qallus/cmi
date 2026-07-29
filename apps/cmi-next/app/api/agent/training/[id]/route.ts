// Bolt training document — update (title/content/enabled) or delete.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function guard(request: Request) {
  const ctx = await requireAdmin(request);
  if (!["super_admin", "admin"].includes(ctx.staff.role_slug)) {
    throw new AuthError("Forbidden — admin only.", 403);
  }
  return ctx;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guard(request);
  } catch (err) {
    const s = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status: s });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { title?: string; content?: string; enabled?: boolean };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = String(body.title).slice(0, 300);
  if (body.content !== undefined) patch.content = String(body.content).slice(0, 200_000);
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;

  const { data, error } = await getSupabaseAdmin()
    .from("bolt_training_docs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ doc: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guard(request);
  } catch (err) {
    const s = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status: s });
  }
  const { id } = await params;
  const sb = getSupabaseAdmin();

  // Remove the stored original file too, if any.
  const { data: existing } = await sb.from("bolt_training_docs").select("file_path").eq("id", id).maybeSingle();
  if (existing?.file_path) await sb.storage.from("bolt-training").remove([existing.file_path]).catch(() => {});

  const { error } = await sb.from("bolt_training_docs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
