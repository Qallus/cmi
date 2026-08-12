import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";

export const runtime = "nodejs";

// Generic audio transcription (OpenAI Whisper) for an uploaded recording.
// Used by the mobile voice-note recorder. The audio is sent straight to Whisper;
// the key never leaves the server.
export async function POST(req: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Transcription isn't configured (OPENAI_API_KEY)." }, { status: 400 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "This recording is too long to transcribe (max 25 MB). Save it without a transcript, or record a shorter note." }, { status: 400 });
    }

    const wForm = new FormData();
    wForm.append("file", file, file.name || "recording.webm");
    wForm.append("model", "whisper-1");
    wForm.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: wForm,
    });
    if (!res.ok) return NextResponse.json({ error: `Transcription failed: ${(await res.text()).slice(0, 200)}` }, { status: 502 });
    return NextResponse.json({ transcript: (await res.text()).trim() });
  } catch {
    return NextResponse.json({ error: "Transcription failed. Please try again." }, { status: 500 });
  }
}
