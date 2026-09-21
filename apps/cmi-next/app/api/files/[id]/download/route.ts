// Proxy download/preview: streams a file from Garage through this server, for
// when Garage has no browser-reachable endpoint (see /api/files/upload).
// ?download=1 forces a save-as instead of inline preview.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getFile } from "@/lib/files/data";
import { getObjectStream, StorageNotConfiguredError } from "@/lib/files/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const url = new URL(request.url);
    const file = await getFile(id);
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

    const thumb = url.searchParams.get("thumb") === "1" && file.thumbnail_key;
    const key = thumb ? (file.thumbnail_key as string) : file.storage_key;
    const range = request.headers.get("range");
    const { body, contentType, contentLength, contentRange } = await getObjectStream(key, range);
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    const safeName = file.name.replace(/["\\\r\n]/g, "_");

    return new NextResponse(body, {
      // 206 when the browser asked for a byte range (video/audio seeking).
      status: contentRange ? 206 : 200,
      headers: {
        "Accept-Ranges": "bytes",
        ...(contentRange ? { "Content-Range": contentRange } : {}),
        "Content-Type": thumb ? "image/jpeg" : contentType ?? file.mime_type ?? "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
        // Private file: never cache in a shared cache. no-transform stops
        // intermediaries (e.g. Cloudflare) from recompressing the stream,
        // which would contradict the Content-Length we send.
        "Cache-Control": "private, max-age=60, no-transform",
      },
    });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
