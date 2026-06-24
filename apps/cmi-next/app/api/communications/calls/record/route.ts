// Start recording on an in-progress call (manual "Record" button on the dialer).
import { NextResponse } from "next/server";
import twilio from "twilio";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { recordingStatusCallbackUrl } from "@/lib/twilio";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const body = await request.json().catch(() => null);
  const callSid = String(body?.callSid || "").trim();
  if (!callSid) return NextResponse.json({ error: "callSid is required." }, { status: 400 });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "Twilio credentials not configured." }, { status: 501 });
  }

  try {
    const client = twilio(accountSid, authToken);
    const recording = await client.calls(callSid).recordings.create({
      recordingStatusCallback: recordingStatusCallbackUrl(),
      recordingStatusCallbackMethod: "POST",
    });
    return NextResponse.json({ recordingSid: recording.sid, status: recording.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start recording." },
      { status: 400 },
    );
  }
}
