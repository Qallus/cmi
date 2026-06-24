// Transcribe a meeting recording with OpenAI Whisper.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { downloadRecording, loadMeeting, updateMeetingFields } from "@/lib/meetings/data";

const ADMIN = ["super_admin", "admin"];
const WHISPER_LIMIT = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const meeting = await loadMeeting(id);
  if (!meeting) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  const isOwner = meeting.created_by === staff.id || meeting.staff_user_id === staff.id;
  if (!ADMIN.includes(staff.role_slug) && !isOwner) {
    return NextResponse.json({ error: "You can't transcribe this meeting." }, { status: 403 });
  }
  if (!meeting.recording_path) return NextResponse.json({ error: "No recording to transcribe." }, { status: 400 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured." }, { status: 501 });

  await updateMeetingFields(id, { status: "processing" });

  try {
    const blob = await downloadRecording(meeting.recording_bucket || "meeting-recordings", meeting.recording_path);
    if (!blob) throw new Error("Could not download the recording from storage.");
    if (blob.size > WHISPER_LIMIT) {
      await updateMeetingFields(id, { status: "draft" });
      return NextResponse.json({
        error: `Recording is ${(blob.size / 1048576).toFixed(0)}MB — over Whisper's 25MB limit. Upload a shorter or compressed audio file (audio-only keeps size down).`,
      }, { status: 413 });
    }

    const form = new FormData();
    form.append("file", blob, meeting.recording_filename || "recording.webm");
    form.append("model", "whisper-1");
    form.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!res.ok) {
      await updateMeetingFields(id, { status: "draft" });
      return NextResponse.json({ error: `Transcription failed: ${(await res.text()).slice(0, 300)}` }, { status: 500 });
    }
    const transcript = (await res.text()).trim();
    await updateMeetingFields(id, { transcript, status: "transcribed" });
    return NextResponse.json({ transcript });
  } catch (err) {
    await updateMeetingFields(id, { status: "draft" }).catch(() => {});
    return NextResponse.json({ error: err instanceof Error ? err.message : "Transcription failed." }, { status: 500 });
  }
}
