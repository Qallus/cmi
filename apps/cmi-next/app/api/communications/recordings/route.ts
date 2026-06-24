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

  // A browser (Voice SDK) call has a parent (client) leg and a child (PSTN) leg
  // from <Dial>. The recording usually attaches to the parent leg while the call
  // history shows the child leg — so we gather recordings across the call itself,
  // its parent, and its child legs, then de-dupe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = new Map<string, any>();
  const collect = async (sid: string) => {
    try {
      const recs = await client.recordings.list({ callSid: sid, limit: 20 });
      recs.forEach((r) => found.set(r.sid, r));
    } catch { /* ignore */ }
  };

  await collect(callSid);

  try {
    const call = await client.calls(callSid).fetch();
    if (call.parentCallSid) await collect(call.parentCallSid);
  } catch { /* ignore */ }

  try {
    const children = await client.calls.list({ parentCallSid: callSid, limit: 5 });
    for (const ch of children) await collect(ch.sid);
  } catch { /* ignore */ }

  const result = Array.from(found.values())
    .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
    .map((rec) => ({
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
