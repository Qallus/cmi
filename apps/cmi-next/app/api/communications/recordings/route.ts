// List recordings for a given call SID.
import { NextResponse } from "next/server";
import twilio from "twilio";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "Twilio credentials not configured." }, { status: 501 });
  }

  const callSid = new URL(request.url).searchParams.get("callSid");
  if (!callSid) return NextResponse.json({ error: "callSid is required." }, { status: 400 });

  const client = twilio(accountSid, authToken);
  const recordings = await client.recordings.list({ callSid, limit: 20 });

  const result = recordings.map((rec) => ({
    sid: rec.sid,
    callSid: rec.callSid,
    duration: rec.duration,
    status: rec.status,
    source: rec.source,
    dateCreated: rec.dateCreated,
    audioUrl: `/api/communications/recordings/audio?sid=${encodeURIComponent(rec.sid)}`,
  }));

  return NextResponse.json({ recordings: result });
}
