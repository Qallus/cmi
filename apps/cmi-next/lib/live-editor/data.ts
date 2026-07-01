// Live Page Editor — data access. All access goes through the service-role
// client; the caller (API route) has already enforced Super Admin.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  ElementDescriptor, ReviewElement, ReviewNote, ReviewSession, SaveNoteInput,
} from "./types";

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
