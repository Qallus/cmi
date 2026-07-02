import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin, AuthError } from "@/lib/auth/require-admin";
import { createNote, listSharedWith, listInbox, listAll, updateNote, deleteNote, markRead, getNote, listComments, addComment } from "@/lib/dashboard-notes/data";
import { sendSharedNoteEmails } from "@/lib/dashboard-notes/notify";
import type { CreateNoteInput } from "@/lib/dashboard-notes/types";

function authFail(err: unknown) {
  const e = err as AuthError;
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function GET(req: NextRequest) {
  let email = "";
  try { const { user } = await requireSuperAdmin(req); email = user.email ?? ""; }
  catch (err) { return authFail(err) ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 }); }
  try {
    const scope = req.nextUrl.searchParams.get("scope") ?? "inbox";
    const notes = scope === "all" ? await listAll()
      : scope === "shared" ? await listSharedWith(email)
      : await listInbox(email);
    const lower = email.toLowerCase();
    const unread = notes.filter((n) => n.recipient_emails.map((e) => e.toLowerCase()).includes(lower)
      && !n.read_by.map((e) => e.toLowerCase()).includes(lower)).length;
    return NextResponse.json({ notes, unread, me: lower });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load notes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let email = "", name = "";
  try {
    const { user, staff } = await requireSuperAdmin(req);
    email = user.email ?? "";
    name = (staff as { display_name?: string }).display_name || email;
  } catch (err) { return authFail(err) ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 }); }

  try {
    const body = await req.json().catch(() => null) as { action?: string; [k: string]: unknown } | null;
    if (!body?.action) return NextResponse.json({ error: "action is required." }, { status: 400 });

    switch (body.action) {
      case "create": {
        const input = body.payload as CreateNoteInput;
        if (!input?.note?.trim()) return NextResponse.json({ error: "Note text is required." }, { status: 400 });
        const note = await createNote(input, { email, name });
        // Share notifications: email recipients (in-app bell is driven by recipient_emails).
        if (note.recipient_emails.length > 0) {
          void sendSharedNoteEmails(note, note.recipient_emails.filter((e) => e !== email.toLowerCase()));
        }
        return NextResponse.json({ note }, { status: 201 });
      }
      case "update_status": {
        const { id, status } = body as { id?: string; status?: string };
        if (!id || !status) return NextResponse.json({ error: "id and status are required." }, { status: 400 });
        const note = await updateNote(id, { status: status as never });
        return NextResponse.json({ note });
      }
      case "mark_read": {
        const { id } = body as { id?: string };
        if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
        await markRead(id, email);
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        const { id } = body as { id?: string };
        if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
        await deleteNote(id);
        return NextResponse.json({ ok: true });
      }
      case "get_note": {
        const { id } = body as { id?: string };
        if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
        const note = await getNote(id);
        if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
        await markRead(id, email);
        const comments = await listComments(id);
        return NextResponse.json({ note, comments });
      }
      case "add_comment": {
        const { id, comment } = body as { id?: string; comment?: string };
        if (!id || !comment?.trim()) return NextResponse.json({ error: "id and comment are required." }, { status: 400 });
        const created = await addComment(id, { email, name }, comment.trim());
        return NextResponse.json({ comment: created }, { status: 201 });
      }
      default:
        return NextResponse.json({ error: `Unknown action "${body.action}".` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Request failed." }, { status: 500 });
  }
}
