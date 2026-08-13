import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EMPTY_DOC, extractPlainText, type WorkspaceScope, type WorkspaceDocListItem, type WorkspaceFolder, type WorkspaceDocument } from "./types";

function personName(p: any): string | null {
  if (!p) return null;
  return p.display_name || p.email || null;
}

export const DEFAULT_WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
export type WorkspaceSpace = { id: string; name: string; icon: string | null };

export async function listWorkspaces(): Promise<WorkspaceSpace[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("workspaces").select("id,name,icon").order("created_at", { ascending: true });
  return (data ?? []) as WorkspaceSpace[];
}

export async function createWorkspace(name: string, profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name: name.trim() || "Untitled workspace", created_by: profileId })
    .select("id,name,icon")
    .single();
  if (error) throw error;
  return data as WorkspaceSpace;
}

export async function listFolders(profileId: string, workspaceId?: string): Promise<WorkspaceFolder[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("workspace_folders")
    .select("id,name,scope,owner_id,parent_id,created_at")
    .is("archived_at", null)
    .or(`scope.eq.shared,and(scope.eq.personal,owner_id.eq.${profileId})`)
    .order("name", { ascending: true });
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data } = await query;
  return (data ?? []) as WorkspaceFolder[];
}

export async function createFolder(input: { name: string; scope: WorkspaceScope; parentId?: string | null; workspaceId?: string | null }, profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workspace_folders")
    .insert({ name: input.name.trim() || "Untitled folder", scope: input.scope, owner_id: input.scope === "personal" ? profileId : null, parent_id: input.parentId || null, workspace_id: input.workspaceId || DEFAULT_WORKSPACE_ID, created_by: profileId })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function listDocuments(profileId: string, workspaceId?: string): Promise<{ mine: WorkspaceDocListItem[]; shared: WorkspaceDocListItem[] }> {
  const supabase = createSupabaseAdminClient();
  let docsQuery = supabase
    .from("workspace_documents")
    .select("id,title,description,scope,folder_id,owner_id,status,updated_at, folder:workspace_folders(name), owner:staff_users!workspace_documents_owner_id_fkey(display_name,email), updater:staff_users!workspace_documents_updated_by_fkey(display_name,email)")
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (workspaceId) docsQuery = docsQuery.eq("workspace_id", workspaceId);
  const [{ data: docs }, { data: favs }, { data: collabDocs }] = await Promise.all([
    docsQuery,
    supabase.from("workspace_favorites").select("document_id").eq("user_id", profileId),
    supabase.from("workspace_collaborators").select("document_id").eq("user_id", profileId),
  ]);

  const favSet = new Set((favs ?? []).map((f: any) => f.document_id));
  const collabSet = new Set((collabDocs ?? []).map((c: any) => c.document_id));

  const map = (d: any): WorkspaceDocListItem => ({
    id: d.id,
    title: d.title,
    description: d.description,
    scope: d.scope,
    folder_id: d.folder_id,
    folder_name: d.folder?.name ?? null,
    owner_id: d.owner_id,
    owner_name: personName(d.owner),
    status: d.status,
    updated_at: d.updated_at,
    updated_by_name: personName(d.updater),
    is_favorite: favSet.has(d.id),
  });

  const mine: WorkspaceDocListItem[] = [];
  const shared: WorkspaceDocListItem[] = [];
  for (const d of docs ?? []) {
    if (d.scope === "personal" && d.owner_id === profileId) mine.push(map(d));
    else if (d.scope === "shared") shared.push(map(d));
    else if (collabSet.has(d.id)) shared.push(map(d)); // personal doc shared with me
  }
  return { mine, shared };
}

/** Load a document if the actor may access it (owner, shared scope, or collaborator). */
export async function getDocument(id: string, profileId: string): Promise<WorkspaceDocument | null> {
  const supabase = createSupabaseAdminClient();
  const { data: doc } = await supabase.from("workspace_documents").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!doc) return null;
  if (doc.scope === "personal" && doc.owner_id !== profileId) {
    const { data: collab } = await supabase.from("workspace_collaborators").select("id").eq("document_id", id).eq("user_id", profileId).maybeSingle();
    if (!collab) return null;
  }
  return doc as WorkspaceDocument;
}

export async function createDocument(input: { title?: string; scope: WorkspaceScope; folderId?: string | null; content?: unknown; workspaceId?: string | null }, profileId: string) {
  const supabase = createSupabaseAdminClient();
  const content = input.content ?? EMPTY_DOC;
  const { data, error } = await supabase
    .from("workspace_documents")
    .insert({
      title: input.title?.trim() || "Untitled",
      scope: input.scope,
      folder_id: input.folderId || null,
      workspace_id: input.workspaceId || DEFAULT_WORKSPACE_ID,
      owner_id: profileId,
      content_json: content,
      plain_text: extractPlainText(content),
      created_by: profileId,
      updated_by: profileId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export type SearchResult = { id: string; title: string; folder_name: string | null; scope: string; updated_at: string; snippet: string | null };

/** Search accessible documents by title or body text. */
export async function searchDocuments(profileId: string, q: string): Promise<SearchResult[]> {
  const term = q.trim();
  if (!term) return [];
  const supabase = createSupabaseAdminClient();
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const { data } = await supabase
    .from("workspace_documents")
    .select("id,title,plain_text,scope,owner_id,updated_at, folder:workspace_folders(name)")
    .is("deleted_at", null)
    .or(`title.ilike.${like},plain_text.ilike.${like}`)
    .order("updated_at", { ascending: false })
    .limit(40);

  const results: SearchResult[] = [];
  for (const d of data ?? []) {
    if (d.scope === "personal" && d.owner_id !== profileId) continue; // only my personal + all shared
    const text: string = d.plain_text ?? "";
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    const snippet = idx >= 0 ? `${idx > 20 ? "…" : ""}${text.slice(Math.max(0, idx - 20), idx + 80)}…` : text.slice(0, 90) || null;
    results.push({ id: d.id, title: d.title, folder_name: (d as any).folder?.name ?? null, scope: d.scope, updated_at: d.updated_at, snippet });
  }
  return results;
}

export type LinkableDoc = { id: string; title: string; owner_name: string | null; created_at: string; workspace_id: string | null; workspace_name: string | null };

/** Documents the actor can link to (owner's personal + all shared), with owner + workspace. */
export async function listLinkableDocuments(profileId: string, q: string, workspaceId?: string): Promise<LinkableDoc[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("workspace_documents")
    .select("id,title,scope,owner_id,created_at,workspace_id, owner:staff_users!workspace_documents_owner_id_fkey(display_name,email), ws:workspaces(name)")
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(40);
  const term = q.trim();
  if (term) query = query.ilike("title", `%${term.replace(/[%_]/g, "")}%`);
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data } = await query;
  const rows: LinkableDoc[] = [];
  for (const d of data ?? []) {
    if (d.scope === "personal" && d.owner_id !== profileId) continue; // personal → owner only
    rows.push({ id: d.id, title: d.title || "Untitled", owner_name: personName((d as any).owner), created_at: d.created_at, workspace_id: d.workspace_id, workspace_name: (d as any).ws?.name ?? null });
  }
  return rows;
}

const SNAPSHOT_THROTTLE_MS = 60_000; // at most one version snapshot per document per ~60s
const MAX_VERSIONS = 60;

export type UpdateResult = { id: string; updatedAt?: string; conflict?: boolean; serverUpdatedAt?: string; serverContent?: unknown };

// Snapshot the CURRENT (pre-save) content as a version, throttled + pruned. Never blocks a save.
async function snapshotIfDue(supabase: any, documentId: string, cur: any, profileId: string) {
  try {
    const { data: last } = await supabase.from("workspace_document_versions").select("created_at").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const lastMs = last?.created_at ? new Date(last.created_at).getTime() : 0;
    if (Date.now() - lastMs < SNAPSHOT_THROTTLE_MS) return;
    if (!(cur.plain_text ?? "").length) return; // skip empty
    await supabase.from("workspace_document_versions").insert({ document_id: documentId, title: cur.title ?? null, content_json: cur.content_json ?? [], char_count: (cur.plain_text ?? "").length, created_by: profileId });
    const { data: extras } = await supabase.from("workspace_document_versions").select("id").eq("document_id", documentId).order("created_at", { ascending: false }).range(MAX_VERSIONS, MAX_VERSIONS + 300);
    const ids = (extras ?? []).map((r: any) => r.id);
    if (ids.length) await supabase.from("workspace_document_versions").delete().in("id", ids);
  } catch { /* snapshotting must never block a save */ }
}

export async function updateDocument(
  id: string,
  input: { title?: string; content?: unknown; folderId?: string | null; scope?: WorkspaceScope; status?: string; expectedUpdatedAt?: string | null; force?: boolean },
  profileId: string,
): Promise<UpdateResult> {
  const supabase = createSupabaseAdminClient();
  const writingContent = input.content !== undefined;

  if (writingContent) {
    const { data: cur } = await supabase.from("workspace_documents").select("content_json, plain_text, title, updated_at").eq("id", id).maybeSingle();
    if (!cur) throw new Error("Document not found.");
    // Conflict guard: refuse to overwrite if the doc changed since the client's baseline (e.g. another device).
    if (!input.force && input.expectedUpdatedAt && cur.updated_at && String(cur.updated_at) !== String(input.expectedUpdatedAt)) {
      return { id, conflict: true, serverUpdatedAt: cur.updated_at as string, serverContent: cur.content_json };
    }
    await snapshotIfDue(supabase, id, cur, profileId);
  }

  const patch: Record<string, unknown> = { updated_by: profileId, updated_at: new Date().toISOString() };
  if (typeof input.title === "string" && input.title.trim()) patch.title = input.title.trim();
  if (writingContent) { patch.content_json = input.content; patch.plain_text = extractPlainText(input.content); }
  if (input.folderId !== undefined) patch.folder_id = input.folderId || null;
  if (input.scope) patch.scope = input.scope;
  if (input.status) {
    patch.status = input.status;
    patch.archived_at = input.status === "archived" ? new Date().toISOString() : null;
  }
  const { data: upd, error } = await supabase.from("workspace_documents").update(patch).eq("id", id).select("updated_at").maybeSingle();
  if (error) throw error;
  return { id, updatedAt: (upd?.updated_at as string) ?? (patch.updated_at as string) };
}

export type DocVersion = { id: string; created_at: string; created_by_name: string | null; char_count: number };

export async function listDocumentVersions(documentId: string): Promise<DocVersion[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("workspace_document_versions")
    .select("id, created_at, char_count, creator:staff_users!workspace_document_versions_created_by_fkey(display_name,email)")
    .eq("document_id", documentId).order("created_at", { ascending: false }).limit(60);
  return (data ?? []).map((v: any) => ({ id: v.id, created_at: v.created_at, created_by_name: personName(v.creator), char_count: v.char_count ?? 0 }));
}

export async function getDocumentVersionContent(versionId: string, documentId: string): Promise<unknown | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("workspace_document_versions").select("content_json").eq("id", versionId).eq("document_id", documentId).maybeSingle();
  return data?.content_json ?? null;
}

export async function restoreDocumentVersion(documentId: string, versionId: string, profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: v } = await supabase.from("workspace_document_versions").select("content_json, title").eq("id", versionId).eq("document_id", documentId).maybeSingle();
  if (!v) throw new Error("Version not found.");
  // Snapshot the current content first so restoring is itself undoable.
  const { data: cur } = await supabase.from("workspace_documents").select("content_json, plain_text, title").eq("id", documentId).maybeSingle();
  if (cur && (cur.plain_text ?? "").length) await supabase.from("workspace_document_versions").insert({ document_id: documentId, title: cur.title ?? null, content_json: cur.content_json ?? [], char_count: (cur.plain_text ?? "").length, created_by: profileId });
  const content = v.content_json ?? [];
  const { data: upd } = await supabase.from("workspace_documents").update({ content_json: content, plain_text: extractPlainText(content), updated_by: profileId, updated_at: new Date().toISOString() }).eq("id", documentId).select("updated_at").maybeSingle();
  return { id: documentId, updatedAt: upd?.updated_at as string };
}

export async function deleteDocument(id: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("workspace_documents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return { id };
}

export type ArchivedDoc = WorkspaceDocListItem & { state: "archived" | "trashed"; deleted_at: string | null; archived_at: string | null };

const ARCHIVED_SELECT = "id,title,description,scope,folder_id,owner_id,status,updated_at,deleted_at,archived_at, folder:workspace_folders(name), owner:staff_users!workspace_documents_owner_id_fkey(display_name,email), updater:staff_users!workspace_documents_updated_by_fkey(display_name,email)";
const mapArchived = (d: any, state: "archived" | "trashed"): ArchivedDoc => ({
  id: d.id, title: d.title, description: d.description, scope: d.scope, folder_id: d.folder_id, folder_name: d.folder?.name ?? null,
  owner_id: d.owner_id, owner_name: personName(d.owner), status: d.status, updated_at: d.updated_at, updated_by_name: personName(d.updater),
  is_favorite: false, state, deleted_at: d.deleted_at ?? null, archived_at: d.archived_at ?? null,
});

/** Archived (status=archived) + trashed (soft-deleted) documents the actor can restore. */
export async function listArchivedDocuments(profileId: string, workspaceId?: string): Promise<ArchivedDoc[]> {
  const supabase = createSupabaseAdminClient();
  const base = () => supabase.from("workspace_documents").select(ARCHIVED_SELECT).order("updated_at", { ascending: false }).limit(200);
  let aq = base().eq("status", "archived").is("deleted_at", null);
  let tq = base().not("deleted_at", "is", null);
  if (workspaceId) { aq = aq.eq("workspace_id", workspaceId); tq = tq.eq("workspace_id", workspaceId); }
  const [{ data: archived }, { data: trashed }] = await Promise.all([aq, tq]);
  const seen = new Set<string>();
  const out: ArchivedDoc[] = [];
  const accept = (d: any, state: "archived" | "trashed") => {
    if (seen.has(d.id)) return;
    if (d.scope === "personal" && d.owner_id !== profileId) return; // personal → owner only
    seen.add(d.id); out.push(mapArchived(d, state));
  };
  for (const d of trashed ?? []) accept(d, "trashed");
  for (const d of archived ?? []) accept(d, "archived");
  return out.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

/** Restore an archived or trashed document back to active. */
export async function restoreDocument(id: string, profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("workspace_documents").update({ status: "active", archived_at: null, deleted_at: null, updated_by: profileId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return { id };
}

/** Permanently delete a document (hard delete — cascades collaborators/favorites). */
export async function purgeDocument(id: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("workspace_documents").delete().eq("id", id);
  if (error) throw error;
  return { id };
}

export type WorkspaceCollaborator = { id: string; user_id: string; name: string; email: string | null; permission: string };
export type ShareableUser = { id: string; name: string; email: string | null };

/** Collaborators on a document + the pool of users that can be added. */
export async function getSharing(documentId: string): Promise<{ collaborators: WorkspaceCollaborator[]; users: ShareableUser[] }> {
  const supabase = createSupabaseAdminClient();
  const [{ data: collab }, { data: people }] = await Promise.all([
    supabase
      .from("workspace_collaborators")
      .select("id, user_id, permission, user:staff_users!workspace_collaborators_user_id_fkey(display_name,email)")
      .eq("document_id", documentId),
    supabase.from("staff_users").select("id,display_name,email").in("status", ["active", "invited"]).order("display_name", { ascending: true }).limit(300),
  ]);
  const collaborators: WorkspaceCollaborator[] = (collab ?? []).map((c: any) => ({
    id: c.id,
    user_id: c.user_id,
    name: personName(c.user) || "Unknown",
    email: c.user?.email ?? null,
    permission: c.permission,
  }));
  const users: ShareableUser[] = (people ?? []).map((p: any) => ({ id: p.id, name: personName(p) || "Unknown", email: p.email ?? null }));
  return { collaborators, users };
}

export async function addCollaborator(documentId: string, userId: string, invitedBy: string, permission = "editor") {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("workspace_collaborators")
    .upsert({ document_id: documentId, user_id: userId, permission, invited_by: invitedBy }, { onConflict: "document_id,user_id" });
  if (error) throw error;
  return { documentId, userId };
}

export async function removeCollaborator(documentId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("workspace_collaborators").delete().eq("document_id", documentId).eq("user_id", userId);
  if (error) throw error;
  return { documentId, userId };
}

export async function listHiddenTemplateIds(): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("workspace_hidden_templates").select("template_id");
  return (data ?? []).map((r: any) => r.template_id as string);
}

export async function hideTemplate(templateId: string, profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("workspace_hidden_templates").upsert({ template_id: templateId, hidden_by: profileId }, { onConflict: "template_id" });
  if (error) throw error;
  return { templateId };
}

export async function unhideTemplate(templateId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("workspace_hidden_templates").delete().eq("template_id", templateId);
  if (error) throw error;
  return { templateId };
}

export async function listFavoriteTemplateIds(userId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("workspace_template_favorites").select("template_id").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.template_id as string);
}

export async function favoriteTemplate(userId: string, templateId: string, on: boolean) {
  const supabase = createSupabaseAdminClient();
  if (on) await supabase.from("workspace_template_favorites").upsert({ user_id: userId, template_id: templateId }, { onConflict: "user_id,template_id" });
  else await supabase.from("workspace_template_favorites").delete().eq("user_id", userId).eq("template_id", templateId);
  return { templateId, favorite: on };
}

export async function toggleFavorite(userId: string, documentId: string, on: boolean) {
  const supabase = createSupabaseAdminClient();
  if (on) await supabase.from("workspace_favorites").upsert({ user_id: userId, document_id: documentId });
  else await supabase.from("workspace_favorites").delete().eq("user_id", userId).eq("document_id", documentId);
  return { documentId, favorite: on };
}
