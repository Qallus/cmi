import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "cmi-media";

function safeName(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return base || "upload";
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const form = await request.formData();
    const file = form.get("file");
    const folder = safeName(String(form.get("folder") || "uploads"));

    if (!(file instanceof File)) {
      throw new Error("File is required.");
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name || `file.${extension}`)}`;

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) throw bucketsError;

    if (!buckets?.some(bucket => bucket.name === BUCKET)) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 1024 * 1024 * 50,
        allowedMimeTypes: ["image/*", "video/*", "application/pdf"]
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
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({
      message: message === "Supabase server credentials are not configured."
        ? "Media uploads need Supabase server credentials. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to apps/cmi-next/.env.local, then restart the app. You can paste an image URL instead for now."
        : message
    }, { status: message === "Supabase server credentials are not configured." ? 503 : 400 });
  }
}
