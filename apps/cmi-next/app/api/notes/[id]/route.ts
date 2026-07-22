// Staff Notes — update / delete / mark-read for one note.
import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { deleteNote, markNoteRead, notifyLinked, updateNote, type NoteInput } from "@/lib/notes/data";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as
    (NoteInput & { notify?: boolean; action?: "mark_read" });

  if (body.action === "mark_read") {
    await markNoteRead(id, staff.id);
    return NextResponse.json({ ok: true });
  }

  const result = await updateNote(id, staff.id, body);
  if (!result) return NextResponse.json({ error: "Not found or no access." }, { status: 404 });

  // Notify only the people just linked, so editing a note doesn't re-ping everyone.
  if (body.notify && result.newlyLinkedEmails.length) {
    void notifyLinked(result.note, { onlyEmails: result.newlyLinkedEmails }).catch(() => {});
  }
  return NextResponse.json({ note: result.note });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ok = await deleteNote(id, staff.id);
  if (!ok) return NextResponse.json({ error: "Only the author can delete this note." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
