// Returns a short-lived signed URL the browser uploads the recording to
// directly (keeps large files off the app server).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { createRecordingUploadUrl } from "@/lib/meetings/data";

export async function POST(request: Request) {
  try { await requireAdmin(request); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const body = await request.json().catch(() => null) as { meetingId?: string; filename?: string } | null;
  if (!body?.meetingId || !body?.filename) {
    return NextResponse.json({ error: "meetingId and filename are required." }, { status: 400 });
  }

  const result = await createRecordingUploadUrl(body.meetingId, body.filename);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
