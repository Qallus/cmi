// Abort a failed multipart upload so orphaned parts don't accumulate in Garage.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { abortMultipart, StorageNotConfiguredError } from "@/lib/files/s3";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { key, uploadId } = (await request.json()) as { key: string; uploadId: string };
    if (!key || !uploadId) return NextResponse.json({ error: "key and uploadId are required." }, { status: 400 });
    await abortMultipart(key, uploadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
