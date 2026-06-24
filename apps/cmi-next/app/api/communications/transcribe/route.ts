// Transcribe a call recording with OpenAI Whisper.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const body = (await request.json().catch(() => null)) as { recordingSid?: string } | null;
  if (!body?.recordingSid) {
    return NextResponse.json({ error: "recordingSid is required." }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "Twilio credentials not configured." }, { status: 501 });
  }
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured. Add it to enable AI transcription." },
      { status: 501 },
    );
  }

  // Pull the recording audio from Twilio.
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${body.recordingSid}.mp3`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const audioRes = await fetch(twilioUrl, { headers: { Authorization: `Basic ${credentials}` } });
  if (!audioRes.ok) {
    return NextResponse.json({ error: "Could not fetch recording from Twilio." }, { status: 404 });
  }

  const audioBuffer = await audioRes.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.mp3");
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!whisperRes.ok) {
    const detail = await whisperRes.text();
    return NextResponse.json({ error: `OpenAI transcription failed: ${detail}` }, { status: 500 });
  }

  const transcript = await whisperRes.text();
  return NextResponse.json({ transcript: transcript.trim() });
}
