// Live Page Editor — data access. All access goes through the service-role
// client; the caller (API route) has already enforced Super Admin.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  ElementDescriptor, Priority, ReviewElement, ReviewNote, ReviewSession,
  SaveNoteInput, SessionSummary,
} from "./types";

const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

export type PageReview = {
  session: ReviewSession | null;
  elements: ReviewElement[];
  notes: ReviewNote[];
};

/** Find the current open session for a page, or create one. */
export async function ensureSession(args: {
  pageSlug: string; pageTitle: string; pageUrl: string; createdBy: string;
}): Promise<ReviewSession> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("page_review_sessions")
    .select("*")
    .eq("page_slug", args.pageSlug)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as ReviewSession;

  const { data, error } = await sb
    .from("page_review_sessions")
    .insert({
      page_slug: args.pageSlug,
      page_title: args.pageTitle,
      page_url: args.pageUrl,
      page_id: args.pageSlug,
      created_by: args.createdBy,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ReviewSession;
}

/** Load the current review (session + elements + notes) for a page. */
export async function loadPageReview(pageSlug: string): Promise<PageReview> {
  const sb = getSupabaseAdmin();
  const { data: session } = await sb
    .from("page_review_sessions")
    .select("*")
    .eq("page_slug", pageSlug)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return { session: null, elements: [], notes: [] };

  const [{ data: elements }, { data: notes }] = await Promise.all([
    sb.from("page_review_elements").select("*").eq("review_session_id", session.id),
    sb.from("page_review_notes").select("*").eq("review_session_id", session.id).order("created_at", { ascending: true }),
  ]);

  return {
    session: session as ReviewSession,
    elements: (elements ?? []) as ReviewElement[],
    notes: (notes ?? []) as ReviewNote[],
  };
}

/** Upsert a detected element into a session, deduped by element_ref. */
export async function upsertElement(
  sessionId: string, pageSlug: string, pageUrl: string, el: ElementDescriptor,
): Promise<ReviewElement> {
  const sb = getSupabaseAdmin();
  if (el.element_ref) {
    const { data: existing } = await sb
      .from("page_review_elements")
      .select("*")
      .eq("review_session_id", sessionId)
      .eq("element_ref", el.element_ref)
      .maybeSingle();
    if (existing) return existing as ReviewElement;
  }

  const { data, error } = await sb
    .from("page_review_elements")
    .insert({
      review_session_id: sessionId,
      page_slug: pageSlug,
      page_url: pageUrl,
      page_id: pageSlug,
      element_type: el.element_type,
      element_label: el.element_label,
      heading_text: el.heading_text,
      heading_level: el.heading_level,
      section_order: el.section_order,
      parent_section_label: el.parent_section_label,
      dom_selector: el.dom_selector,
      dom_path: el.dom_path,
      css_classes: el.css_classes,
      component_name: el.component_name,
      element_ref: el.element_ref,
      content_summary: el.content_summary,
      bounding_box_json: el.bounding_box ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ReviewElement;
}

export async function saveNote(input: SaveNoteInput, createdBy: string): Promise<{
  session: ReviewSession; element: ReviewElement; note: ReviewNote;
}> {
  const session = await ensureSession({
    pageSlug: input.page_slug, pageTitle: input.page_title, pageUrl: input.page_url, createdBy,
  });
  const element = await upsertElement(session.id, input.page_slug, input.page_url, input.element);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("page_review_notes")
    .insert({
      review_session_id: session.id,
      element_id: element.id,
      note: input.note,
      priority: input.priority,
      status: input.status,
      change_type: input.change_type,
      insert_kind: input.insert_kind ?? null,
      component_name: input.component_name ?? null,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { session, element, note: data as ReviewNote };
}

export async function updateNote(id: string, patch: Partial<Pick<ReviewNote,
  "note" | "priority" | "status" | "change_type">>): Promise<ReviewNote> {
  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status === "resolved") update.resolved_at = new Date().toISOString();
  const { data, error } = await sb
    .from("page_review_notes").update(update).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as ReviewNote;
}

export async function deleteNote(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("page_review_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Full session bundle used for export (notes + their elements). */
export async function loadSessionBundle(sessionId: string): Promise<{
  session: ReviewSession; elements: ReviewElement[]; notes: ReviewNote[];
} | null> {
  const sb = getSupabaseAdmin();
  const { data: session } = await sb
    .from("page_review_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) return null;
  const [{ data: elements }, { data: notes }] = await Promise.all([
    sb.from("page_review_elements").select("*").eq("review_session_id", sessionId),
    sb.from("page_review_notes").select("*").eq("review_session_id", sessionId).order("created_at", { ascending: true }),
  ]);
  return {
    session: session as ReviewSession,
    elements: (elements ?? []) as ReviewElement[],
    notes: (notes ?? []) as ReviewNote[],
  };
}

/** Summaries for the Saved Reviews gallery: one row per session with counts. */
export async function listSessions(): Promise<SessionSummary[]> {
  const sb = getSupabaseAdmin();
  const { data: sessions, error } = await sb
    .from("page_review_sessions").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!sessions?.length) return [];

  const ids = sessions.map((s) => s.id);
  const { data: notes } = await sb
    .from("page_review_notes")
    .select("review_session_id, status, priority, created_at")
    .in("review_session_id", ids);

  const bySession = new Map<string, { count: number; open: number; resolved: number; top: number; last: string }>();
  for (const n of notes ?? []) {
    const agg = bySession.get(n.review_session_id) ?? { count: 0, open: 0, resolved: 0, top: -1, last: "" };
    agg.count += 1;
    if (n.status === "resolved" || n.status === "archived") agg.resolved += 1; else agg.open += 1;
    agg.top = Math.max(agg.top, PRIORITY_RANK[(n.priority as Priority)] ?? -1);
    if (n.created_at > agg.last) agg.last = n.created_at;
    bySession.set(n.review_session_id, agg);
  }

  const rankToPriority = (r: number): Priority | null =>
    (Object.entries(PRIORITY_RANK).find(([, v]) => v === r)?.[0] as Priority) ?? null;

  return (sessions as ReviewSession[]).map((session) => {
    const agg = bySession.get(session.id);
    return {
      session,
      note_count: agg?.count ?? 0,
      open_count: agg?.open ?? 0,
      resolved_count: agg?.resolved ?? 0,
      top_priority: agg && agg.top >= 0 ? rankToPriority(agg.top) : null,
      last_activity: agg?.last && agg.last > session.updated_at ? agg.last : session.updated_at,
    };
  });
}

/** Delete a review session; elements, notes, exports, and notifications cascade. */
export async function deleteSession(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("page_review_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateSession(id: string, patch: Partial<Pick<ReviewSession,
  "status" | "requester_name" | "requester_email">>): Promise<ReviewSession> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("page_review_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as ReviewSession;
}

export async function recordNotification(args: {
  sessionId: string; toEmail: string; toName: string | null; subject: string; body: string;
  statusSnapshot: string; provider: string | null; providerId: string | null; error: string | null; sentBy: string;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("page_review_notifications").insert({
    review_session_id: args.sessionId, to_email: args.toEmail, to_name: args.toName,
    subject: args.subject, body: args.body, status_snapshot: args.statusSnapshot,
    provider: args.provider, provider_id: args.providerId, error: args.error, sent_by: args.sentBy,
  });
  if (!args.error) {
    await sb.from("page_review_sessions")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", args.sessionId);
  }
}

export async function recordExport(args: {
  sessionId: string; fileType: string; payload: unknown; createdBy: string; aiVisible: boolean;
}): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("page_review_exports")
    .insert({
      review_session_id: args.sessionId,
      file_type: args.fileType,
      export_payload: args.payload as Record<string, unknown>,
      created_by: args.createdBy,
      ai_visible: args.aiVisible,
      ai_processed_at: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
