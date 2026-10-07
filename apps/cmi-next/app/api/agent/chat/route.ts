import { NextResponse, type NextRequest } from "next/server";
import { requireBolt, boltErrorResponse } from "@/lib/agent/guard";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import { loadTrainingContext } from "@/lib/agent/training";
import { toolDefsFor, dispatchTool } from "@/lib/agent/tools";
import type { ChatMessage, PendingAction, StaffContext, ToolActivity } from "@/lib/agent/types";

const MAX_ITERATIONS = 6;

export async function POST(req: NextRequest) {
  let ctx: StaffContext;
  try {
    ({ ctx } = await requireBolt(req));
  } catch (err) {
    return boltErrorResponse(err);
  }

  const hermesUrl = process.env.HERMES_AGENT_URL;
  const hermesKey = process.env.HERMES_AGENT_API_KEY;
  const hermesModel = process.env.HERMES_AGENT_MODEL ?? "hermes-agent";
  if (!hermesUrl) {
    return NextResponse.json({ error: "Bolt is not configured (HERMES_AGENT_URL)." }, { status: 501 });
  }

  const body = await req.json().catch(() => null) as { messages?: Array<{ role: string; content: string }>; jobContext?: string } | null;
  if (!body?.messages?.length) return NextResponse.json({ error: "messages are required." }, { status: 400 });
  const jobContext = typeof body.jobContext === "string" && body.jobContext.trim() ? body.jobContext.trim() : null;

  // Rebuild the conversation: our trusted system prompt (plus any staff-uploaded
  // training knowledge) + the user/assistant history.
  const trainingContext = await loadTrainingContext().catch(() => "");
  const history = body.messages.filter((m) => m.role === "user" || m.role === "assistant");
  const convo: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx, jobContext) + trainingContext },
    ...history.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
  ];

  const upstream = `${hermesUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (hermesKey) headers["Authorization"] = `Bearer ${hermesKey}`;

  const activities: ToolActivity[] = [];
  const pendingActions: PendingAction[] = [];
  const tools = await toolDefsFor(ctx);

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const res = await fetch(upstream, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: hermesModel, messages: convo, tools, tool_choice: "auto" }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: `Bolt gateway error (${res.status}): ${text.slice(0, 400)}` }, { status: 502 });
      }
      const json = await res.json() as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        choices?: Array<{ message?: { content?: string; tool_calls?: any[] } }>;
      };
      const msg = json.choices?.[0]?.message;
      if (!msg) return NextResponse.json({ error: "Empty response from Bolt gateway." }, { status: 502 });

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return NextResponse.json({
          message: { role: "assistant", content: msg.content ?? "" },
          activities,
          pendingActions,
        });
      }

      // The model wants to call tools. Record the assistant turn, then execute each.
      convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { args = {}; }
        const outcome = await dispatchTool(tc.function?.name ?? "", args, ctx);
        activities.push(outcome.activity);
        if (outcome.pending) pendingActions.push(outcome.pending);
        convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(outcome.result).slice(0, 6000) });
      }
    }

    return NextResponse.json({
      message: { role: "assistant", content: "I ran several steps but didn't reach a final answer — ask me to continue if needed." },
      activities,
      pendingActions,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bolt request failed." }, { status: 502 });
  }
}
