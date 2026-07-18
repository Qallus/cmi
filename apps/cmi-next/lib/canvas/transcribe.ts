// Voice-pin transcription via OpenAI Whisper (same provider the call-recording
// and meeting features use). Audio is pulled from the private bucket with the
// service role; the key never leaves the server.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CANVAS_MEDIA_BUCKET } from "./types";

export async function transcribeCanvasAudio(path: string): Promise<{ transcript: string } | { error: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "Transcription is not configured (OPENAI_API_KEY)." };

  const { data, error } = await getSupabaseAdmin().storage.from(CANVAS_MEDIA_BUCKET).download(path);
  if (error || !data) return { error: "Could not read the audio file." };

  const form = new FormData();
  form.append("file", data, "voice-note.webm");
  form.append("model", "whisper-1");
  form.append("response_format", "text");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) return { error: `Transcription failed: ${(await res.text()).slice(0, 200)}` };
  return { transcript: (await res.text()).trim() };
}
