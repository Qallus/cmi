// Bolt training documents — list + create. Admin-only (same guard as Bolt).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function guard(request: Request) {
  const { user, staff } = await requireAdmin(request);
  if (!["super_admin", "admin"].includes(staff.role_slug)) {
    throw new AuthError("Forbidden — admin only.", 403);
  }
  return { user, staff };
}

export async function GET(request: Request) {
  try {
    await guard(request);
  } catch (err) {
    const s = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status: s });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("bolt_training_docs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ docs: data ?? [] });
}

export async function POST(request: Request) {
  let staff;
  try {
    ({ staff } = await guard(request));
  } catch (err) {
    const s = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status: s });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string; content?: string; source_name?: string; file_path?: string;
  };
  const title = String(body.title ?? "").trim().slice(0, 300);
  const content = String(body.content ?? "").trim().slice(0, 200_000);
  if (!title && !content) return NextResponse.json({ error: "A title or content is required." }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("bolt_training_docs")
    .insert({
      title: title || (body.source_name ?? "Untitled"),
      content,
      source_name: body.source_name ? String(body.source_name).slice(0, 300) : null,
      file_path: body.file_path ? String(body.file_path).slice(0, 500) : null,
      created_by: (staff as { id: string }).id,
      created_by_name: (staff as { display_name?: string }).display_name ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ doc: data });
}
