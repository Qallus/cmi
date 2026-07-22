// Staff Notes — server data layer. Every function assumes the caller has
// already resolved the acting staff member (visibility is enforced here).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isSuppressed } from "@/lib/messaging/consent";
import { NOTE_STATUSES, type NoteStatus, type StaffNote, type NoteAttachment } from "./types";

type Row = Omit<StaffNote, "linked_staff">;

function normalize(row: Row): StaffNote {
  return {
    ...row,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    linked_staff_ids: row.linked_staff_ids ?? [],
    linked_emails: row.linked_emails ?? [],
    read_by: row.read_by ?? [],
  };
}

/** Notes visible to this staff member: authored by them or linked to them. */
export async function listNotesFor(staffId: string): Promise<StaffNote[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("staff_notes")
    .select("*")
    .or(`author_staff_id.eq.${staffId},linked_staff_ids.cs.{${staffId}}`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const notes = (data ?? []).map((r) => normalize(r as Row));

  // Resolve linked-staff display info in one batch for the UI.
  const ids = Array.from(new Set(notes.flatMap((n) => n.linked_staff_ids)));
  if (ids.length) {
    const { data: staff } = await sb.from("staff_users").select("id, display_name, email").in("id", ids);
    const byId = new Map((staff ?? []).map((s) => [s.id, s]));
    for (const n of notes) {
      n.linked_staff = n.linked_staff_ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((s) => ({ id: s!.id, name: s!.display_name ?? s!.email ?? "Staff", email: s!.email ?? "" }));
    }
  }
  return notes;
}

/** Can this staff member read/modify this note? */
async function loadOwnedOrLinked(sb: ReturnType<typeof getSupabaseAdmin>, noteId: string, staffId: string): Promise<Row | null> {
  const { data } = await sb.from("staff_notes").select("*").eq("id", noteId).maybeSingle();
  if (!data) return null;
  const row = data as Row;
  const allowed = row.author_staff_id === staffId || (row.linked_staff_ids ?? []).includes(staffId);
  return allowed ? row : null;
}

export type NoteInput = {
  title?: string;
  body?: string;
  status?: NoteStatus;
  color?: string;
  attachments?: NoteAttachment[];
  linked_staff_ids?: string[];
  linked_emails?: string[];
  due_date?: string | null;
};

function clean(input: NoteInput) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = String(input.title).slice(0, 300);
  if (input.body !== undefined) patch.body = String(input.body).slice(0, 100_000);
  if (input.status !== undefined && NOTE_STATUSES.includes(input.status)) patch.status = input.status;
  if (input.color !== undefined) patch.color = String(input.color).slice(0, 24);
  if (input.attachments !== undefined) patch.attachments = input.attachments.slice(0, 50);
  if (input.linked_staff_ids !== undefined) patch.linked_staff_ids = input.linked_staff_ids.slice(0, 100);
  if (input.linked_emails !== undefined) {
    patch.linked_emails = input.linked_emails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .slice(0, 100);
  }
  if (input.due_date !== undefined) patch.due_date = input.due_date || null;
  return patch;
}

export async function createNote(actor: { id: string; name: string | null }, input: NoteInput): Promise<StaffNote> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("staff_notes")
    .insert({ author_staff_id: actor.id, author_name: actor.name, ...clean(input) })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalize(data as Row);
}

export async function updateNote(
  noteId: string,
  staffId: string,
  input: NoteInput,
): Promise<{ note: StaffNote; newlyLinkedEmails: string[] } | null> {
  const sb = getSupabaseAdmin();
  const existing = await loadOwnedOrLinked(sb, noteId, staffId);
  if (!existing) return null;

  const before = new Set(existing.linked_emails ?? []);
  const { data, error } = await sb
    .from("staff_notes")
    .update({ ...clean(input), updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const note = normalize(data as Row);
  const newlyLinkedEmails = note.linked_emails.filter((e) => !before.has(e));
  return { note, newlyLinkedEmails };
}

export async function deleteNote(noteId: string, staffId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const existing = await loadOwnedOrLinked(sb, noteId, staffId);
  if (!existing) return false;
  // Only the author can delete; a linked viewer can't remove someone else's note.
  if (existing.author_staff_id !== staffId) return false;
  const { error } = await sb.from("staff_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  return true;
}

/** Mark a note read by a linked staff member (clears their "new" nudge). */
export async function markNoteRead(noteId: string, staffId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("staff_notes").select("read_by").eq("id", noteId).maybeSingle();
  const readBy: string[] = data?.read_by ?? [];
  if (readBy.includes(staffId)) return;
  await sb.from("staff_notes").update({ read_by: [...readBy, staffId] }).eq("id", noteId);
}

/**
 * Notify people newly linked to a note. In-app is handled by the note showing
 * up in their list (read_by drives the badge); here we send the email nudge to
 * linked staff and external addresses, best-effort and suppression-aware.
 */
export async function notifyLinked(note: StaffNote, opts: { onlyEmails?: string[] } = {}): Promise<void> {
  const sb = getSupabaseAdmin();

  const emails = new Set<string>(opts.onlyEmails ?? note.linked_emails);
  // Add linked staff emails unless caller restricted to a specific set.
  if (!opts.onlyEmails && note.linked_staff_ids.length) {
    const { data } = await sb.from("staff_users").select("email").in("id", note.linked_staff_ids);
    for (const s of data ?? []) if (s.email) emails.add(String(s.email).toLowerCase());
  }
  if (emails.size === 0) return;

  const subject = `${note.author_name ?? "A teammate"} linked you on a note: ${note.title || "Untitled"}`;
  for (const to of emails) {
    try {
      if (await isSuppressed("email", to)) continue;
      await sendNoteEmail(to, subject, note);
    } catch {
      // best-effort; never block the save on a notification
    }
  }
}

async function sendNoteEmail(to: string, subject: string, note: StaffNote): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return;
  const body = (note.body || "").slice(0, 600);
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: `${note.author_name ?? "A teammate"} linked you on a note in the CMI dashboard.\n\n${note.title || "Untitled"}\n\n${body}\n\nOpen the dashboard to view it.`,
    }),
  });
}
