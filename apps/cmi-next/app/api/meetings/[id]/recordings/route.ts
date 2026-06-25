// Add or remove individual recordings on a meeting (supports multiple).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { addRecordingEntry, removeRecordingEntry } from "@/lib/meetings/data";

const ADMIN = ["super_admin", "admin"];

async function authz(request: Request, id: string) {
  const { staff } = await requireAdmin(request);
  const { data } = await getSupabaseAdmin().from("meetings").select("created_by, staff_user_id").eq("id", id).maybeSingle();
  if (!data) throw new AuthError("Meeting not found.", 404);
  const owner = data.created_by === staff.id || data.staff_user_id === staff.id;
  if (!ADMIN.includes(staff.role_slug) && !owner) throw new AuthError("You can't modify this meeting.", 403);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await authz(request, id); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const body = await request.json().catch(() => null) as { path?: string; filename?: string; mime?: string } | null;
  if (!body?.path || !body?.filename) return NextResponse.json({ error: "path and filename are required." }, { status: 400 });
  try {
    await addRecordingEntry(id, { path: body.path, filename: body.filename, mime: body.mime });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await authz(request, id); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const recordingId = new URL(request.url).searchParams.get("recordingId");
  if (!recordingId) return NextResponse.json({ error: "recordingId is required." }, { status: 400 });
  try {
    await removeRecordingEntry(id, recordingId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 400 });
  }
}
