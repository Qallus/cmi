// Short-lived presigned GET URL for a file (preview or download).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getFile } from "@/lib/files/data";
import { presignGet, directDelivery, StorageNotConfiguredError } from "@/lib/files/s3";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const file = await getFile(id);
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const reqUrl = new URL(request.url);
    const download = reqUrl.searchParams.get("download") === "1";
    // Grid thumbnails: small JPEG instead of the full-size object.
    const wantThumb = reqUrl.searchParams.get("thumb") === "1" && !!file.thumbnail_key;
    if (wantThumb) {
      const thumbUrl = directDelivery()
        ? await presignGet(file.thumbnail_key as string)
        : `${reqUrl.origin}/api/files/${file.id}/download?thumb=1`;
      return NextResponse.json({ url: thumbUrl, name: file.name, mime: "image/jpeg" });
    }
    // Direct mode hands out a presigned Garage URL; proxy mode streams through
    // this server. Absolute either way, so "Copy link" produces a usable link.
    const url = directDelivery()
      ? await presignGet(file.storage_key, download ? file.name : undefined)
      : `${reqUrl.origin}/api/files/${file.id}/download${download ? "?download=1" : ""}`;
    return NextResponse.json({ url, name: file.name, mime: file.mime_type });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
