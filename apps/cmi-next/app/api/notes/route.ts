// Staff Notes — list + create. Staff-only; visibility enforced in the data layer.
import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createNote, listNotesFor, notifyLinked, type NoteInput } from "@/lib/notes/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notes, staffList] = await Promise.all([
    listNotesFor(staff.id),
    getSupabaseAdmin().from("staff_users").select("id, display_name, email").eq("status", "active").order("display_name"),
  ]);

  return NextResponse.json({
    notes,
    me: { id: staff.id, name: staff.display_name },
    staffOptions: (staffList.data ?? []).map((s) => ({ id: s.id, name: s.display_name ?? s.email ?? "Staff", email: s.email ?? "" })),
  });
}

export async function POST(request: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as NoteInput & { notify?: boolean };
  const note = await createNote({ id: staff.id, name: staff.display_name }, body);

  if (body.notify) {
    // Fire-and-forget; don't make the client wait on email.
    void notifyLinked(note).catch(() => {});
  }
  return NextResponse.json({ note });
}
