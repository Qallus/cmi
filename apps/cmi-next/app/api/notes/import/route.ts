// Import notes from a previously-exported JSON array. Each imported note is
// created fresh under the current staff member (attachments/links are not
// carried over — text content only, to keep import safe and portable).
import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { createNote } from "@/lib/notes/data";
import { NOTE_STATUSES, NOTE_COLORS, type NoteStatus } from "@/lib/notes/types";

export const dynamic = "force-dynamic";

type Incoming = { title?: unknown; body?: unknown; status?: unknown; color?: unknown; due_date?: unknown };

export async function POST(request: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { notes?: Incoming[] } | Incoming[] | null;
  const rows = Array.isArray(body) ? body : body?.notes;
  if (!Array.isArray(rows)) return NextResponse.json({ error: "Expected a JSON array of notes." }, { status: 400 });

  const colorKeys = new Set<string>(NOTE_COLORS.map((c) => c.key));
  let imported = 0;
  for (const raw of rows.slice(0, 500)) {
    const title = typeof raw.title === "string" ? raw.title : "";
    const bodyText = typeof raw.body === "string" ? raw.body : "";
    if (!title.trim() && !bodyText.trim()) continue;
    const status = (NOTE_STATUSES as readonly string[]).includes(String(raw.status)) ? (raw.status as NoteStatus) : "open";
    const color = colorKeys.has(String(raw.color)) ? String(raw.color) : "default";
    const due = typeof raw.due_date === "string" && raw.due_date ? raw.due_date : null;
    await createNote({ id: staff.id, name: staff.display_name }, { title, body: bodyText, status, color, due_date: due });
    imported++;
  }

  return NextResponse.json({ ok: true, imported });
}
