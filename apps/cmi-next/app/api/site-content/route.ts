import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json() as { id?: string; [key: string]: unknown };
    if (body.id) {
      const { id, ...patch } = body;
      const { data, error } = await supabase.from("site_content").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase.from("site_content").insert(body).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
