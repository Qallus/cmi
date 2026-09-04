// Short-lived presigned GET URL for a file (preview or download).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getFile } from "@/lib/files/data";
import { presignGet, StorageNotConfiguredError } from "@/lib/files/s3";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const file = await getFile(id);
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const url = await presignGet(file.storage_key, download ? file.name : undefined);
    return NextResponse.json({ url, name: file.name, mime: file.mime_type });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
