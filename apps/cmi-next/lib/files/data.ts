// Data-access layer for the Cloud file manager. Service-role client (RLS is
// deny-by-default); role/ownership gating lives in the API routes.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { deleteObject } from "./s3";
import { FILE_ADMIN_ROLES, type FileRow, type FolderRow } from "./types";

type Scope = { projectId?: string | null; folderId?: string | null };

// A staff member may modify/delete a row they own, or anything if an admin role.
export function canModify(row: { uploaded_by?: string | null; created_by?: string | null }, staff: { id: string; role_slug: string }): boolean {
  if (FILE_ADMIN_ROLES.includes(staff.role_slug)) return true;
  return (row.uploaded_by ?? row.created_by) === staff.id;
}

// ── Folders ──
export async function listFolders(scope: Scope & { trashed?: boolean }): Promise<FolderRow[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("folders").select("*").order("name", { ascending: true });
  q = scope.trashed ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  if (scope.projectId === null) q = q.is("project_id", null);
  else if (scope.projectId) q = q.eq("project_id", scope.projectId);
  if (!scope.trashed) { q = scope.folderId ? q.eq("parent_id", scope.folderId) : q.is("parent_id", null); }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as FolderRow[];
}

export async function getFolder(id: string): Promise<FolderRow | null> {
  const { data, error } = await getSupabaseAdmin().from("folders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FolderRow) ?? null;
}

export async function createFolder(input: { name: string; project_id?: string | null; job_id?: string | null; parent_id?: string | null }, actorId: string): Promise<FolderRow> {
  const { data, error } = await getSupabaseAdmin().from("folders").insert({
    name: input.name.trim() || "Untitled folder",
    project_id: input.project_id ?? null,
    job_id: input.job_id ?? null,
    parent_id: input.parent_id ?? null,
    created_by: actorId,
  }).select().single();
  if (error) throw new Error(error.message);
  return data as FolderRow;
}

export async function updateFolder(id: string, patch: Partial<Pick<FolderRow, "name" | "parent_id" | "deleted_at">>): Promise<FolderRow> {
  const { data, error } = await getSupabaseAdmin().from("folders").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as FolderRow;
}

// Permanently delete a folder subtree: all descendant folders + their files
// (objects removed from Garage), then the folder itself.
export async function purgeFolder(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const ids = [id];
  // Gather descendants breadth-first.
  let frontier = [id];
  while (frontier.length) {
    const { data } = await supabase.from("folders").select("id").in("parent_id", frontier);
    const next = (data ?? []).map((r) => r.id as string);
    ids.push(...next);
    frontier = next;
  }
  const { data: files } = await supabase.from("files").select("id, storage_key, thumbnail_key").in("folder_id", ids);
  for (const f of files ?? []) {
    await deleteObject(f.storage_key as string);
    if (f.thumbnail_key) await deleteObject(f.thumbnail_key as string);
  }
  await supabase.from("files").delete().in("folder_id", ids);
  await supabase.from("folders").delete().in("id", ids);
}

// ── Files ──
export async function listFiles(scope: Scope & { trashed?: boolean; uploadedBy?: string; recent?: boolean }): Promise<FileRow[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("files").select("*");
  q = scope.trashed ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  if (scope.uploadedBy) q = q.eq("uploaded_by", scope.uploadedBy);
  if (scope.projectId === null) q = q.is("project_id", null);
  else if (scope.projectId) q = q.eq("project_id", scope.projectId);
  // Folder scoping only applies to the browsing view (not recent/trash/my-uploads).
  if (!scope.trashed && !scope.recent && !scope.uploadedBy) { q = scope.folderId ? q.eq("folder_id", scope.folderId) : q.is("folder_id", null); }
  q = scope.recent ? q.order("created_at", { ascending: false }).limit(50) : q.order("name", { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as FileRow[];
}

export async function searchFiles(term: string): Promise<FileRow[]> {
  const { data, error } = await getSupabaseAdmin().from("files").select("*").is("deleted_at", null).ilike("name", `%${term}%`).order("name").limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as FileRow[];
}

export async function getFile(id: string): Promise<FileRow | null> {
  const { data, error } = await getSupabaseAdmin().from("files").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FileRow) ?? null;
}

export async function insertFile(row: {
  name: string; storage_key: string; thumbnail_key?: string | null; mime_type?: string | null; size_bytes?: number | null;
  project_id?: string | null; job_id?: string | null; folder_id?: string | null; uploaded_by: string;
}): Promise<FileRow> {
  const { data, error } = await getSupabaseAdmin().from("files").insert({
    name: row.name,
    storage_key: row.storage_key,
    thumbnail_key: row.thumbnail_key ?? null,
    mime_type: row.mime_type ?? null,
    size_bytes: row.size_bytes ?? null,
    project_id: row.project_id ?? null,
    job_id: row.job_id ?? null,
    folder_id: row.folder_id ?? null,
    uploaded_by: row.uploaded_by,
  }).select().single();
  if (error) throw new Error(error.message);
  return data as FileRow;
}

export async function updateFile(id: string, patch: Partial<Pick<FileRow, "name" | "folder_id" | "deleted_at">>): Promise<FileRow> {
  const { data, error } = await getSupabaseAdmin().from("files").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as FileRow;
}

export async function purgeFile(row: FileRow): Promise<void> {
  await deleteObject(row.storage_key);
  if (row.thumbnail_key) await deleteObject(row.thumbnail_key);
  const { error } = await getSupabaseAdmin().from("files").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
}

// Storage-used total (bytes) across non-deleted files.
export async function storageUsedBytes(): Promise<number> {
  const { data } = await getSupabaseAdmin().from("files").select("size_bytes").is("deleted_at", null);
  return (data ?? []).reduce((sum, r) => sum + (Number(r.size_bytes) || 0), 0);
}
