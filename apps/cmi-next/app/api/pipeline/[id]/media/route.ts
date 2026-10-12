// Photos and videos on a Pre-Con opportunity. Files are uploaded first
// (/api/admin/uploads); this records them against the opportunity.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "superintendent", "estimator"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin().from("opportunity_media")
      .select("id, url, media_type, name, note, created_by, created_at").eq("opportunity_id", id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load media." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Your role can't add media here." }, { status: 403 });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { media?: { url: string; type?: string; name?: string }[]; note?: string };
    const media = (body.media ?? []).filter((m) => m && typeof m.url === "string" && m.url);
    if (!media.length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    const note = (body.note ?? "").trim() || null;
    const { data, error } = await getSupabaseAdmin().from("opportunity_media").insert(media.map((m) => ({
      opportunity_id: id, url: m.url, media_type: m.type === "video" ? "video" : "image", name: m.name ?? null, note, created_by: user.email ?? null,
    }))).select();
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save media." }, { status: 500 });
  }
}
