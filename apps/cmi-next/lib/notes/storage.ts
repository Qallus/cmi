// Signed-URL helpers for the private notes-media bucket. Mirrors canvas storage:
// browser PUTs to a signed upload URL; reads are short-lived signed URLs.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { NOTES_MEDIA_BUCKET } from "./types";

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";
}

// folder is the object prefix — the acting staff id, so media-url access can
// key off the path prefix.
export async function createNoteUploadUrl(folder: string, filename: string): Promise<{ path: string; token: string; signedUrl: string } | { error: string }> {
  const sb = getSupabaseAdmin();
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName(filename)}`;
  const { data, error } = await sb.storage.from(NOTES_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message || "Could not create upload URL." };
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function getNoteMediaUrl(path: string | null, expiresIn = 7200): Promise<string | null> {
  if (!path) return null;
  const { data } = await getSupabaseAdmin().storage.from(NOTES_MEDIA_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
