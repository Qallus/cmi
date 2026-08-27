import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { normalizePortfolioInput } from "@/lib/portfolio/data";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Restore from Trash: just clear deleted_at (don't re-validate the whole row).
    if (new URL(request.url).searchParams.get("restore") === "true") {
      const { data, error } = await supabase.from("portfolio").update({ deleted_at: null, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return NextResponse.json({ item: data });
    }

    const payload = normalizePortfolioInput(await request.json());
    const row = {
      ...payload,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("portfolio").update(row).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio update failed." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";
    if (permanent) {
      // Delete Forever (from Trash) — actually removes the row.
      const { error } = await supabase.from("portfolio").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    // Default: soft delete → moves the item to Trash (recoverable).
    const { error } = await supabase.from("portfolio").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio delete failed." }, { status: 400 });
  }
}
