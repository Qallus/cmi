// Signed-URL helpers for the PRIVATE canvas-media bucket. Uploads use a signed
// upload URL the browser PUTs to directly (no server body-size limit); reads are
// short-lived signed URLs. Mirrors the meeting-recordings pattern.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CANVAS_MEDIA_BUCKET } from "./types";

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";
}

// folder is the object prefix, e.g. `${canvasId}/${sceneId}` for scene media or
// `${canvasId}/${sceneId}/audio` for voice pins.
export async function createCanvasUploadUrl(folder: string, filename: string): Promise<{ path: string; token: string; signedUrl: string } | { error: string }> {
  const sb = getSupabaseAdmin();
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName(filename)}`;
  const { data, error } = await sb.storage.from(CANVAS_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message || "Could not create upload URL." };
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function getCanvasMediaUrl(path: string | null, expiresIn = 7200): Promise<string | null> {
  if (!path) return null;
  const { data } = await getSupabaseAdmin().storage.from(CANVAS_MEDIA_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function removeCanvasMedia(paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (!clean.length) return;
  await getSupabaseAdmin().storage.from(CANVAS_MEDIA_BUCKET).remove(clean).catch(() => {});
}
