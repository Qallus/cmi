import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

const CONTENT_ROLES = ["super_admin", "admin", "designer"];

export async function POST(req: NextRequest) {
  try {
    const { staff } = await requireAdmin(req);
    if (!CONTENT_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: "You do not have access to edit site content." }, { status: 403 });
    }
    const supabase = getSupabaseAdmin();
    const body = await req.json() as { id?: string; [key: string]: unknown };
    if (body.id) {
      const { id, ...patch } = body;
      const { data, error } = await supabase.from("site_content_blocks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase.from("site_content_blocks").insert(body).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data, { status: 201 });
    }
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
