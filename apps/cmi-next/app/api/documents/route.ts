import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json() as { id?: string; [key: string]: unknown };
    if (body.id) {
      const { id, ...patch } = body;
      const { data, error } = await supabase.from("documents").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    } else {
      const id = `DOC-${Date.now()}`;
      const { data, error } = await supabase.from("documents").insert({ ...body, id }).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string };
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
