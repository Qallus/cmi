// Proxy Twilio recording audio so account credentials never reach the browser.
import { NextResponse } from "next/server";
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

  const recordingSid = new URL(request.url).searchParams.get("sid");
  if (!recordingSid) return NextResponse.json({ error: "sid is required." }, { status: 400 });

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const upstream = await fetch(twilioUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!upstream.ok) return NextResponse.json({ error: "Recording not found." }, { status: 404 });

  const audio = await upstream.arrayBuffer();
  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
