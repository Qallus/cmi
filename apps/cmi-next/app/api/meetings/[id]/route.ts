import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { deleteMeeting, getRecordingPlaybackUrl, loadMeeting, saveMeeting } from "@/lib/meetings/data";
import type { SaveMeetingPayload } from "@/lib/meetings/types";

const ADMIN = ["super_admin", "admin"];
const VIEW_ALL = ["super_admin", "admin", "project_manager"];

async function authz(request: Request, id: string, mode: "view" | "edit") {
  const { staff } = await requireAdmin(request);
  const { data } = await getSupabaseAdmin().from("meetings").select("created_by, staff_user_id").eq("id", id).maybeSingle();
  if (!data) throw new AuthError("Meeting not found.", 404);
  const isOwner = data.created_by === staff.id || data.staff_user_id === staff.id;
  const allowed = mode === "view" ? (VIEW_ALL.includes(staff.role_slug) || isOwner) : (ADMIN.includes(staff.role_slug) || isOwner);
  if (!allowed) throw new AuthError("You don't have access to this meeting.", 403);
  return staff;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await authz(request, id, "view"); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const meeting = await loadMeeting(id);
  if (!meeting) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });

  let playbackUrl: string | null = null;
  if (meeting.recording_path) {
    playbackUrl = await getRecordingPlaybackUrl(meeting.recording_bucket || "meeting-recordings", meeting.recording_path);
  }
  return NextResponse.json({ meeting, playbackUrl });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let staff;
  try { staff = await authz(request, id, "edit"); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const body = (await request.json().catch(() => null)) as SaveMeetingPayload | null;
  if (!body) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  try {
    const meeting = await saveMeeting({ ...body, id }, staff.id);
    return NextResponse.json({ meeting });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await authz(request, id, "edit"); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
  try {
    await deleteMeeting(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 400 });
  }
}
