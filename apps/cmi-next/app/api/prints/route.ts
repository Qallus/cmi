import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { firstImage } from "@/components/print-builder/print-doc";
import type { EmailBlock } from "@/components/email-builder/types";

// Prints library: list (summary) + create.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { data, error } = await getSupabaseAdmin()
      .from("print_documents")
      .select("id, name, page_size, orientation, status, thumbnail_url, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ prints: data ?? [] });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Failed to load prints." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const blocks = (Array.isArray(body.blocks) ? body.blocks : []) as EmailBlock[];
    const { data, error } = await getSupabaseAdmin()
      .from("print_documents")
      .insert({
        name: String(body.name ?? "Untitled Print"),
        page_size: String(body.page_size ?? "letter"),
        orientation: body.orientation === "landscape" ? "landscape" : "portrait",
        width_in: body.width_in != null ? Number(body.width_in) : null,
        height_in: body.height_in != null ? Number(body.height_in) : null,
        blocks,
        html: String(body.html ?? ""),
        thumbnail_url: firstImage(blocks),
        status: body.status === "active" ? "active" : "draft",
        created_by: staff.id,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ print: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Failed to create print." }, { status: 400 });
  }
}
