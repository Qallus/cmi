import { getSupabaseAdmin } from "@/lib/supabase/server";

// Shared upload helper for the public "cmi-media" bucket. Mirrors the logic in
// app/api/admin/uploads/route.ts so job files (and future modules) share one path.
const BUCKET = "cmi-media";
const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const ALLOWED_MIME_EXACT = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "text/csv"];
const MAX_FILE_SIZE = 1024 * 1024 * 50; // 50 MB

function safeName(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return base || "upload";
}

export type UploadResult = { url: string; path: string; mime: string; size: number; name: string };

export async function uploadToMedia(file: File, folder = "uploads"): Promise<UploadResult> {
  const supabase = getSupabaseAdmin();
  const mimeType = file.type || "";
  const isAllowed = ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) || ALLOWED_MIME_EXACT.includes(mimeType);
  if (!isAllowed) throw new Error(`File type "${mimeType || "unknown"}" is not allowed.`);
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds the 50 MB size limit.");

  const cleanFolder = safeName(folder);
  const path = `${cleanFolder}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name || "file")}`;

  // Ensure the bucket exists (idempotent).
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_FILE_SIZE });
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600", contentType: file.type || "application/octet-stream", upsert: false,
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl, path, mime: mimeType, size: file.size, name: file.name };
}
