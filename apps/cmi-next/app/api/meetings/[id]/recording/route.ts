// Delete just the audio recording for a meeting (keeps the meeting record).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { removeRecording } from "@/lib/meetings/data";

const ADMIN = ["super_admin", "admin"];

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const { data } = await getSupabaseAdmin().from("meetings").select("created_by, staff_user_id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  const isOwner = data.created_by === staff.id || data.staff_user_id === staff.id;
  if (!ADMIN.includes(staff.role_slug) && !isOwner) {
    return NextResponse.json({ error: "You can't modify this meeting." }, { status: 403 });
  }

  try {
    await removeRecording(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not remove recording." }, { status: 400 });
  }
}
