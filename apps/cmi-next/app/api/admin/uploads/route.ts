import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

const BUCKET = "cmi-media";
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_MIME_EXACT = [
  "application/pdf",
  // Office / document types (Workspace media + attachments)
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];
const MAX_FILE_SIZE = 1024 * 1024 * 50; // 50 MB

function safeName(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return base || "upload";
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const form = await request.formData();
    const file = form.get("file");
    const folder = safeName(String(form.get("folder") || "uploads"));

    if (!(file instanceof File)) {
      throw new Error("File is required.");
    }

    // Server-side MIME type validation
    const mimeType = file.type || "";
    const isAllowed =
      ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
      ALLOWED_MIME_EXACT.includes(mimeType);
    if (!isAllowed) {
      throw new Error(`File type "${mimeType || "unknown"}" is not allowed. Only images, videos, and PDFs are accepted.`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File exceeds the 50 MB size limit.");
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name || `file.${extension}`)}`;

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) throw bucketsError;

    if (!buckets?.some(bucket => bucket.name === BUCKET)) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 1024 * 1024 * 50
      });
      if (createError) throw createError;
    }

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
      upsert: false
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      bucket: BUCKET,
      path,
      url: data.publicUrl,
      name: file.name,
      type: file.type,
      size: file.size
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message === "Supabase server credentials are not configured." ? 503 : 400;
    return NextResponse.json({ message }, { status });
  }
}
