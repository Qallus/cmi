// Per-call notes, persisted in the call_notes table (keyed by Twilio Call SID).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function authError(err: unknown) {
  const e = err as AuthError;
  return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return authError(err);
  }

  const callSid = new URL(request.url).searchParams.get("callSid") || "";
  if (!callSid) return NextResponse.json({ error: "callSid is required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("call_notes")
    .select("id, note, created_at")
    .eq("call_sid", callSid)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(request: Request) {
  let staffId: string | null = null;
  try {
    const { staff } = await requireAdmin(request);
    staffId = staff.id;
  } catch (err) {
    return authError(err);
  }

  const body = await request.json().catch(() => null);
  const callSid = String(body?.callSid || "").trim();
  const note = String(body?.note || "").trim();
  if (!callSid) return NextResponse.json({ error: "callSid is required." }, { status: 400 });
  if (!note) return NextResponse.json({ error: "note text is required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("call_notes").insert({
    call_sid: callSid,
    note,
    author_id: staffId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return authError(err);
  }

  const noteId = new URL(request.url).searchParams.get("id") || "";
  if (!noteId) return NextResponse.json({ error: "Note id is required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("call_notes").delete().eq("id", noteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
