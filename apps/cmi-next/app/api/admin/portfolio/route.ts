import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadPortfolioItems, normalizePortfolioInput } from "@/lib/portfolio/data";

export async function GET() {
  try {
    const items = await loadPortfolioItems();
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio load failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = normalizePortfolioInput(await request.json());
    const row = {
      ...payload,
      published_at: payload.status === "published" ? new Date().toISOString() : null,
      sync_status: "local"
    };
    const { data, error } = await supabase.from("portfolio").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio create failed." }, { status: 400 });
  }
}
