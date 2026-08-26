import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExtensionAccess, ExtensionAuthError } from "@/lib/extension/require-extension-access";
import { corsHeaders, preflight } from "@/lib/extension/cors";
import { reqHttpUrl, ValidationError } from "@/lib/extension/validate";

export const dynamic = "force-dynamic";

const BUCKET = "cmi-media";
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export async function OPTIONS(request: Request) {
  return preflight(request);
}

// Re-host a vendor image: fetch server-side, validate, store in Supabase
// Storage, return the public URL. Images are never hotlinked (vendor URLs
// expire/change), so the saved card keeps a stable image.
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  try {
    await requireExtensionAccess(request);
    const body = (await request.json()) as Record<string, unknown>;
    const url = reqHttpUrl(body.url, "Image URL");

    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new ValidationError(`Could not fetch image (HTTP ${res.status}).`);

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new ValidationError("The URL did not return an image.");
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new ValidationError("The image was empty.");
    if (buf.length > MAX_BYTES) throw new ValidationError("Image exceeds the 15 MB limit.");

    const ext = EXT_BY_MIME[contentType] ?? "jpg";
    const path = `selections/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buf, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ bucket: BUCKET, path, url: data.publicUrl }, { headers });
  } catch (e) {
    if (e instanceof ExtensionAuthError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers });
    }
    return NextResponse.json({ error: "Failed to ingest image." }, { status: 500, headers });
  }
}
