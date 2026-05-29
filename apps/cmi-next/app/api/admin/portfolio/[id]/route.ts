import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizePortfolioInput } from "@/lib/portfolio/data";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const payload = normalizePortfolioInput(await request.json());
    const row = {
      ...payload,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("portfolio").update(row).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio update failed." }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("portfolio").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio delete failed." }, { status: 400 });
  }
}
