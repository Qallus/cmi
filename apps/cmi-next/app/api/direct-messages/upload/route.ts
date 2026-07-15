import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

const BUCKET = "cmi-media";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function kindFor(mime: string): "image" | "audio" | "video" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-") || "file";
}

// Upload a DM attachment to the shared media bucket; returns the attachment object.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File is required." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File exceeds the 25 MB limit." }, { status: 400 });

    const path = `direct-messages/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name || "file")}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      attachment: { type: kindFor(file.type || ""), url: data.publicUrl, name: file.name, mimeType: file.type, size: file.size },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
