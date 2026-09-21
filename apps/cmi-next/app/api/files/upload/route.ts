// Proxy upload: the browser PUTs here and this server streams the bytes on to
// Garage over the tailnet. Used when S3_PUBLIC_ENDPOINT isn't set (Garage has
// no browser-reachable HTTPS endpoint). The response carries the ETag header,
// so the client flow is identical to a presigned PUT straight to Garage.
//   PUT /api/files/upload?key=...                      → single object
//   PUT /api/files/upload?key=...&uploadId=..&part=1   → one multipart part
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  isOwnKey, putObjectStream, uploadPartStream, MAX_FILE_BYTES, PART_SIZE_BYTES, StorageNotConfiguredError,
} from "@/lib/files/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bytes stream straight through; nothing is buffered to disk.
export const maxDuration = 300;

export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    const q = new URL(request.url).searchParams;
    const key = q.get("key") ?? "";
    if (!isOwnKey(key)) return NextResponse.json({ error: "Invalid storage key." }, { status: 400 });

    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0) return NextResponse.json({ error: "Content-Length is required." }, { status: 411 });
    if (!request.body) return NextResponse.json({ error: "Empty request body." }, { status: 400 });

    const uploadId = q.get("uploadId");
    const partNumber = Number(q.get("part"));
    const contentType = request.headers.get("content-type") || "application/octet-stream";
    // Allow a little headroom over the part size for encoding overhead.
    const cap = uploadId ? PART_SIZE_BYTES + 1024 * 1024 : MAX_FILE_BYTES;
    if (length > cap) return NextResponse.json({ error: "Upload is larger than the allowed size." }, { status: 413 });

    if (uploadId && (!Number.isInteger(partNumber) || partNumber < 1)) {
      return NextResponse.json({ error: "Invalid part number." }, { status: 400 });
    }

    const body = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
    const etag = uploadId
      ? await uploadPartStream(key, uploadId, partNumber, body, length)
      : await putObjectStream(key, body, contentType, length);
    return new NextResponse(null, { status: 200, headers: { ETag: `"${etag}"`, "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
