import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function personName(p: any): string | null {
  if (!p) return null;
  return p.display_name || p.email || null;
}

export type WorkspaceComment = {
  id: string;
  document_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  body: string;
  quote: string | null;
  mentioned_user_ids: string[];
  resolved_at: string | null;
  created_at: string;
};

export type MentionUser = { id: string; name: string };

export async function listComments(documentId: string): Promise<WorkspaceComment[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("workspace_comments")
    .select("*, author:staff_users!workspace_comments_author_id_fkey(display_name,email)")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((c: any) => ({
    id: c.id,
    document_id: c.document_id,
    parent_id: c.parent_id,
    author_id: c.author_id,
    author_name: personName(c.author),
    body: c.body,
    quote: c.quote,
    mentioned_user_ids: c.mentioned_user_ids ?? [],
    resolved_at: c.resolved_at,
    created_at: c.created_at,
  }));
}

export async function listMentionableUsers(): Promise<MentionUser[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("staff_users")
    .select("id,display_name,email")
    .in("status", ["active", "invited"])
    .order("display_name", { ascending: true })
    .limit(200);
  return (data ?? []).map((p: any) => ({ id: p.id, name: personName(p) || "Unknown" }));
}

export async function createComment(
  input: { documentId: string; body: string; quote?: string | null; parentId?: string | null; mentionedUserIds?: string[] },
  authorId: string,
) {
  if (!input.body?.trim()) throw new Error("Comment body is required.");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workspace_comments")
    .insert({
      document_id: input.documentId,
      parent_id: input.parentId || null,
      author_id: authorId,
      body: input.body.trim(),
      quote: input.quote?.trim() || null,
      mentioned_user_ids: input.mentionedUserIds ?? [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function setCommentResolved(id: string, resolved: boolean, actorId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("workspace_comments")
    .update({ resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? actorId : null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { id, resolved };
}

export async function deleteComment(id: string) {
  const supabase = createSupabaseAdminClient();
  // Replies cascade via parent_id FK.
  const { error } = await supabase.from("workspace_comments").delete().eq("id", id);
  if (error) throw error;
  return { id };
}
