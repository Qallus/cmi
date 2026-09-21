// Presign an upload. ≤90 MB → one PUT URL; larger → multipart with 90 MB part URLs.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  isAllowedMime, storageKeyFor, thumbKeyFor, presignPut, startMultipart, presignPart,
  partCountFor, directDelivery, SINGLE_MAX_BYTES, PART_SIZE_BYTES, MAX_FILE_BYTES, StorageNotConfiguredError,
} from "@/lib/files/s3";

// Where the browser should PUT: straight to Garage when it has a public HTTPS
// endpoint, otherwise through this server (see /api/files/upload).
const proxyPut = (key: string, multipart?: { uploadId: string; partNumber: number }) =>
  `/api/files/upload?key=${encodeURIComponent(key)}${multipart ? `&uploadId=${encodeURIComponent(multipart.uploadId)}&part=${multipart.partNumber}` : ""}`;

type Body = { name: string; size: number; mime: string; projectId?: string | null; jobId?: string | null; folderId?: string | null; withThumb?: boolean };

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as Body;
    const name = String(body.name || "").trim();
    const size = Number(body.size);
    const mime = String(body.mime || "application/octet-stream");
    if (!name) return NextResponse.json({ error: "File name is required." }, { status: 400 });
    if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "Invalid file size." }, { status: 400 });
    if (size > MAX_FILE_BYTES) return NextResponse.json({ error: `File exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024 / 1024)} GB limit.` }, { status: 400 });
    if (!isAllowedMime(mime)) return NextResponse.json({ error: `File type "${mime}" is not allowed.` }, { status: 400 });

    const key = storageKeyFor(body.projectId ?? null, name);

    // Optional client-generated image thumbnail gets its own presigned PUT.
    const direct = directDelivery();
    const thumb = body.withThumb && mime.startsWith("image/")
      ? { thumbKey: thumbKeyFor(key), thumbUrl: direct ? await presignPut(thumbKeyFor(key), "image/jpeg") : proxyPut(thumbKeyFor(key)) }
      : null;

    if (size <= SINGLE_MAX_BYTES) {
      return NextResponse.json({ mode: "single", key, url: direct ? await presignPut(key, mime) : proxyPut(key), ...(thumb ?? {}) });
    }

    const uploadId = await startMultipart(key, mime);
    const count = partCountFor(size);
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => i + 1).map(async (partNumber) => ({
        partNumber,
        url: direct ? await presignPart(key, uploadId, partNumber) : proxyPut(key, { uploadId, partNumber }),
      })),
    );
    return NextResponse.json({ mode: "multipart", key, uploadId, partSize: PART_SIZE_BYTES, parts, ...(thumb ?? {}) });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
