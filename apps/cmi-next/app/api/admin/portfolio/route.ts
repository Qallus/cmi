import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadPortfolioItems, normalizePortfolioInput } from "@/lib/portfolio/data";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const items = await loadPortfolioItems();
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio load failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const payload = normalizePortfolioInput(await request.json());
    const { data, error } = await supabase.from("portfolio").insert(payload).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio create failed." }, { status: 400 });
  }
}
