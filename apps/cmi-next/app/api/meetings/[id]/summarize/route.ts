// Generate a summary, action items, and suggestions from a meeting transcript
// using the Bolt/Hermes gateway.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadMeeting, updateMeetingFields } from "@/lib/meetings/data";

const ADMIN = ["super_admin", "admin"];

function uid() { try { return crypto.randomUUID(); } catch { return `ai-${Date.now()}-${Math.round(Math.random() * 1e6)}`; } }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let staff;
  try { ({ staff } = await requireAdmin(request)); }
  catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }

  const meeting = await loadMeeting(id);
  if (!meeting) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  const isOwner = meeting.created_by === staff.id || meeting.staff_user_id === staff.id;
  if (!ADMIN.includes(staff.role_slug) && !isOwner) {
    return NextResponse.json({ error: "You can't summarize this meeting." }, { status: 403 });
  }
  if (!meeting.transcript?.trim()) return NextResponse.json({ error: "Transcribe the meeting first." }, { status: 400 });

  const hermesUrl = process.env.HERMES_AGENT_URL;
  const hermesKey = process.env.HERMES_AGENT_API_KEY;
  const hermesModel = process.env.HERMES_AGENT_MODEL ?? "hermes-agent";
  if (!hermesUrl) return NextResponse.json({ error: "AI engine not configured (HERMES_AGENT_URL)." }, { status: 501 });

  const system = `You are Bolt, the AI meeting analyst for Constructed Matter, Inc. (a construction/remodeling company). Read the meeting transcript and respond with STRICT JSON only (no prose, no markdown) in this exact shape:
{"summary": "a concise paragraph summary", "action_items": ["short imperative task", ...], "suggestions": ["follow-up / risk / next-step suggestion", ...]}
Focus on: client and project details, decisions, budget/timeline notes, product selections, change requests, responsibilities, risks, and next steps. Keep action_items and suggestions short and specific. If the transcript is empty or unusable, return empty arrays and a brief summary saying so.`;

  try {
    const res = await fetch(`${hermesUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(hermesKey ? { Authorization: `Bearer ${hermesKey}` } : {}) },
      body: JSON.stringify({
        model: hermesModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Meeting: ${meeting.title}\nType: ${meeting.meeting_type}\n\nTranscript:\n${meeting.transcript.slice(0, 24000)}` },
        ],
      }),
    });
    if (!res.ok) return NextResponse.json({ error: `AI error (${res.status}): ${(await res.text()).slice(0, 300)}` }, { status: 502 });
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";

    // Parse the JSON object from the model output (tolerant of stray text).
    let parsed: { summary?: string; action_items?: string[]; suggestions?: string[] } = {};
    try {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { summary: content };
    } catch {
      parsed = { summary: content };
    }

    const action_items = (parsed.action_items ?? []).map((t) => ({ id: uid(), text: String(t), done: false }));
    const ai_suggestions = (parsed.suggestions ?? []).map((s) => String(s));

    await updateMeetingFields(id, {
      summary: parsed.summary ?? "",
      action_items,
      ai_suggestions,
      status: action_items.length ? "action_items_created" : "reviewed",
    });

    return NextResponse.json({ summary: parsed.summary ?? "", action_items, ai_suggestions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Summary failed." }, { status: 502 });
  }
}
