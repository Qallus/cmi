import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { updateJobNote, deleteJobNote } from "@/lib/job-notes/data";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  try {
    await requireAdmin(request);
    const { noteId } = await params;
    const body = (await request.json().catch(() => ({}))) as { pinned?: boolean; body?: string };
    const note = await updateJobNote(noteId, body);
    return NextResponse.json({ note });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  try {
    await requireAdmin(request);
    const { noteId } = await params;
    await deleteJobNote(noteId);
    return NextResponse.json({ ok: true });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 400 }); }
}
