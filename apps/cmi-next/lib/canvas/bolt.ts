// Bolt for Project Canvas — runs through the existing Hermes gateway (the same
// OpenAI-compatible deployment /api/agent/chat uses), but with a constrained,
// tool-less preamble scoped to construction-project intake. No pricing promises.
import type { CanvasContext } from "./serialize";

export type BoltMessage = { role: "system" | "user" | "assistant"; content: string };

export function hermesConfigured(): boolean {
  return !!process.env.HERMES_AGENT_URL;
}

export function canvasBoltPreamble(context: CanvasContext, actorName: string): string {
  return `You are **Bolt**, the friendly design assistant inside Constructed Matter, Inc.'s Project Canvas — a tool where a homeowner sketches ideas on photos of their space so the CMI team can build from them.

You are helping ${actorName}. Be warm, concise, and practical, in CMI's confident craft-forward voice.

RULES
- Stay strictly within home construction / renovation / outdoor-living scope. If asked something off-topic, gently steer back to their project.
- NEVER quote prices, costs, dollar figures, or timelines as commitments. If asked about cost, say the CMI team will provide an estimate.
- Don't invent details that aren't in the canvas. Ask a short clarifying question when unsure.
- Encourage the person to capture what they want with pins, drawings, and outlines so the team gets a complete picture.

CURRENT CANVAS (authoritative — this is what they've captured so far):
${context.summary}`;
}

type HermesResult = { content: string } | { error: string };

export async function callHermes(messages: BoltMessage[]): Promise<HermesResult> {
  const url = process.env.HERMES_AGENT_URL;
  const key = process.env.HERMES_AGENT_API_KEY;
  const model = process.env.HERMES_AGENT_MODEL ?? "hermes-agent";
  if (!url) return { error: "Bolt is not configured (HERMES_AGENT_URL)." };

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.6 }),
    });
    if (!res.ok) return { error: `Bolt gateway error (${res.status}).` };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return { error: "Bolt returned an empty response." };
    return { content };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bolt request failed." };
  }
}

// Best-effort JSON extraction from a model reply (handles ```json fences / prose).
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  const slice = candidate.slice(start);
  try { return JSON.parse(slice) as T; } catch { /* fall through */ }
  // Trim trailing prose after the last bracket.
  const lastCurly = slice.lastIndexOf("}");
  const lastSquare = slice.lastIndexOf("]");
  const end = Math.max(lastCurly, lastSquare);
  if (end > 0) { try { return JSON.parse(slice.slice(0, end + 1)) as T; } catch { /* noop */ } }
  return null;
}
