// Returns a short-lived signed playback URL for a specific recording path.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getRecordingPlaybackUrl } from "@/lib/meetings/data";

const VIEW_ALL = ["super_admin", "admin", "project_manager"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const path = new URL(request.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

  const { data } = await getSupabaseAdmin().from("meetings").select("created_by, staff_user_id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  const owner = data.created_by === staff.id || data.staff_user_id === staff.id;
  if (!VIEW_ALL.includes(staff.role_slug) && !owner) return NextResponse.json({ error: "No access." }, { status: 403 });

  const url = await getRecordingPlaybackUrl("meeting-recordings", path);
  return NextResponse.json({ url });
}
