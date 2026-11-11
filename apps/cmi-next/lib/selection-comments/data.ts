// Selection comment threads (client ↔ team). Server only; service role.
// selection_comments predates the thread (2026-05-28: comment_body, user_id,
// comment_type, client_visible); 2026-11-12_selection_comments.sql extends it.
// Until that's applied, reads fall back to the old client_comments text and
// writes say the migration is needed.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { parseLegacyComments, summarize, type CommentSummary, type SelectionComment } from "./thread";

export class CommentsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const NOT_MIGRATED = "Apply 2026-11-12_selection_comments.sql first.";
const missing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST204" || /selection_comments|client_comments_imported_at/.test(e.message ?? "") && /exist|schema cache/i.test(e.message ?? ""));

/** The thread's columns, named as the app uses them (body = comment_body, staff author = user_id). */
const COLS = "id, selection_id, job_id, author_kind, author_contact_id, author_staff_id:user_id, author_name, action, body:comment_body, created_at, handled_at, handled_by";
/** Client notes and staff replies are both part of the client's conversation. */
const VISIBLE = { comment_type: "client", client_visible: true } as const;

type SelRow = {
  id: string; job_id?: string | null; client_comments?: string | null; client_comments_imported_at?: string | null;
  client_rejected_at?: string | null; client_approved_at?: string | null; updated_at?: string | null;
};

/** Copy old client_comments text into the thread, once per selection. */
async function importLegacy(rows: SelRow[], jobId: string | null): Promise<void> {
  const todo = rows.filter((r) => r.client_comments?.trim() && !r.client_comments_imported_at);
  if (!todo.length) return;
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  for (const r of todo) {
    const at = r.client_rejected_at || r.client_approved_at || r.updated_at || now;
    const entries = parseLegacyComments(r.client_comments, at);
    if (entries.length) {
      const { error } = await sb.from("selection_comments").insert(entries.map((e) => ({
        selection_id: r.id, job_id: r.job_id ?? jobId, author_kind: "client", author_name: e.author_name, ...VISIBLE,
        action: e.stamped ? "comment" : "legacy", comment_body: e.body, created_at: e.created_at,
      })));
      if (error) { if (missing(error)) return; throw new CommentsError(error.message, 500); }
    }
    await sb.from("project_selections").update({ client_comments_imported_at: now }).eq("id", r.id).is("client_comments_imported_at", null);
  }
}

/** Per-selection comment summaries for a job's views (count, open, latest). */
export async function commentSummaries(jobId: string, selections: SelRow[]): Promise<Record<string, CommentSummary>> {
  const out: Record<string, CommentSummary> = {};
  if (!selections.length) return out;
  const sb = getSupabaseAdmin();
  try { await importLegacy(selections, jobId); } catch (e) { console.error("[selection-comments] import failed", e); }
  const { data, error } = await sb.from("selection_comments").select(COLS).in("selection_id", selections.map((s) => s.id));
  if (error) {
    if (!missing(error)) console.error("[selection-comments] summaries", error.message);
    // Not migrated yet: show the old text as one comment so nothing is hidden.
    for (const s of selections) {
      if (!s.client_comments?.trim()) continue;
      out[s.id] = { count: 1, open: 1, latest: { author_kind: "client", author_name: "Client", body: s.client_comments, action: "legacy", created_at: s.client_rejected_at || s.client_approved_at || s.updated_at || "" } };
    }
    return out;
  }
  const by = new Map<string, SelectionComment[]>();
  for (const c of (data ?? []) as unknown as SelectionComment[]) by.set(c.selection_id, [...(by.get(c.selection_id) ?? []), c]);
  for (const [id, list] of by) out[id] = summarize(list);
  return out;
}

async function selectionRow(selId: string): Promise<SelRow & { name: string | null; client_visible: boolean | null }> {
  const { data, error } = await getSupabaseAdmin().from("project_selections").select("*").eq("id", selId).maybeSingle();
  if (error) throw new CommentsError(error.message, 500);
  if (!data) throw new CommentsError("Selection not found.", 404);
  return data as SelRow & { name: string | null; client_visible: boolean | null };
}

/** The whole thread, oldest first. */
export async function listComments(selId: string, jobId: string | null): Promise<{ comments: SelectionComment[]; migrated: boolean }> {
  const sel = await selectionRow(selId);
  try { await importLegacy([sel], jobId); } catch (e) { console.error("[selection-comments] import failed", e); }
  const { data, error } = await getSupabaseAdmin().from("selection_comments").select(COLS).eq("selection_id", selId).order("created_at", { ascending: true });
  if (error) {
    if (!missing(error)) throw new CommentsError(error.message, 500);
    const at = sel.client_rejected_at || sel.client_approved_at || sel.updated_at || new Date().toISOString();
    const legacy = parseLegacyComments(sel.client_comments, at).map((e, i) => ({
      id: `legacy-${i}`, selection_id: selId, job_id: jobId, author_kind: "client" as const, author_contact_id: null, author_staff_id: null,
      author_name: e.author_name, action: "legacy", body: e.body, created_at: e.created_at, handled_at: null, handled_by: null,
    }));
    return { comments: legacy, migrated: false };
  }
  return { comments: (data ?? []) as unknown as SelectionComment[], migrated: true };
}

/** A client's comment or decision (from the portal). Best-effort when not migrated. */
export async function addClientComment(selId: string, jobId: string, who: { id: string; name: string }, action: string, body: string | null): Promise<void> {
  const sb = getSupabaseAdmin();
  const sel = await selectionRow(selId);
  try { await importLegacy([sel], jobId); } catch (e) { console.error("[selection-comments] import failed", e); }
  const { error } = await sb.from("selection_comments").insert({
    selection_id: selId, job_id: jobId, author_kind: "client", author_contact_id: who.id, author_name: who.name, ...VISIBLE,
    action, comment_body: body?.trim() || null,
  });
  if (error && !missing(error)) console.error("[selection-comments] client comment", error.message);
  // The caller adds this note to client_comments next; mark it imported so it isn't copied twice.
  if (!error) await sb.from("project_selections").update({ client_comments_imported_at: new Date().toISOString() }).eq("id", selId);
}

/** A team member answers in the thread: it shows in the client's portal and they get the usual notice. */
export async function addStaffReply(selId: string, jobId: string, staff: { id: string; name: string }, body: string): Promise<SelectionComment> {
  const text = body.trim();
  if (!text) throw new CommentsError("Write a reply first.");
  if (text.length > 4000) throw new CommentsError("Keep the reply under 4,000 characters.");
  const sel = await selectionRow(selId);
  const sb = getSupabaseAdmin();
  try { await importLegacy([sel], jobId); } catch (e) { console.error("[selection-comments] import failed", e); }
  const now = new Date().toISOString();
  const { data, error } = await sb.from("selection_comments").insert({
    selection_id: selId, job_id: jobId, author_kind: "staff", user_id: staff.id, author_name: staff.name, ...VISIBLE,
    action: "reply", comment_body: text, created_at: now,
  }).select(COLS).single();
  if (error) throw new CommentsError(missing(error) ? NOT_MIGRATED : error.message, missing(error) ? 409 : 500);
  // Answering covers what the client said before it.
  await sb.from("selection_comments").update({ handled_at: now, handled_by: staff.id })
    .eq("selection_id", selId).eq("author_kind", "client").is("handled_at", null);
  await sb.from("selection_activity").insert({ selection_id: selId, action: "staff.reply", description: `${staff.name} replied: ${text.slice(0, 200)}`, metadata: { job_id: jobId, staff_id: staff.id } })
    .then(() => undefined, () => undefined);
  if (sel.client_visible) {
    const { notifyJobClients } = await import("@/lib/client-portal/notifications");
    await notifyJobClients(jobId, { type: "selection_reply", title: `${staff.name} replied about ${sel.name ?? "your selection"}`, body: text.slice(0, 300), link: `/client/jobs/${jobId}/selections` })
      .catch((e) => console.error("[selection-comments] client notice", e));
  }
  return data as unknown as SelectionComment;
}

/** Mark a client comment handled (or open again). */
export async function setHandled(selId: string, commentId: string, staffId: string, handled: boolean): Promise<SelectionComment> {
  const { data, error } = await getSupabaseAdmin().from("selection_comments")
    .update(handled ? { handled_at: new Date().toISOString(), handled_by: staffId } : { handled_at: null, handled_by: null })
    .eq("id", commentId).eq("selection_id", selId).select(COLS).maybeSingle();
  if (error) throw new CommentsError(missing(error) ? NOT_MIGRATED : error.message, missing(error) ? 409 : 500);
  if (!data) throw new CommentsError("Comment not found.", 404);
  return data as unknown as SelectionComment;
}

/** What a client sees of each thread: who, what, when (no handled state or staff ids). Null when not migrated. */
export type ClientThreadEntry = { author_kind: "client" | "staff"; author_name: string | null; action: string; body: string | null; created_at: string };
export async function clientThreads(jobId: string, selections: SelRow[]): Promise<Record<string, ClientThreadEntry[]> | null> {
  if (!selections.length) return {};
  try { await importLegacy(selections, jobId); } catch (e) { console.error("[selection-comments] import failed", e); }
  const { data, error } = await getSupabaseAdmin().from("selection_comments")
    .select("selection_id, author_kind, author_name, action, body:comment_body, created_at")
    .in("selection_id", selections.map((s) => s.id)).eq("client_visible", true).order("created_at", { ascending: true });
  if (error) return null;
  const out: Record<string, ClientThreadEntry[]> = {};
  for (const r of (data ?? []) as unknown as (ClientThreadEntry & { selection_id: string })[]) {
    const { selection_id, ...entry } = r;
    (out[selection_id] ??= []).push(entry);
  }
  return out;
}
