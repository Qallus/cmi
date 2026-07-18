import { NextResponse } from "next/server";
import { getCanvasWithScenes } from "@/lib/canvas/data";
import { buildCanvasContext } from "@/lib/canvas/serialize";
import { callHermes, canvasBoltPreamble, extractJson, hermesConfigured, type BoltMessage } from "@/lib/canvas/bolt";
import { canvasErrorResponse, requireCanvasActor } from "@/lib/canvas/route-helpers";

export const dynamic = "force-dynamic";

type Body = {
  canvasId?: string;
  mode?: "chat" | "suggest_pins" | "read_back";
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(request: Request) {
  try {
    const actor = await requireCanvasActor(request);
    if (!hermesConfigured()) return NextResponse.json({ error: "Bolt isn't configured yet. Add HERMES_AGENT_URL to enable it." }, { status: 501 });

    const body = (await request.json().catch(() => ({}))) as Body;
    if (!body.canvasId) return NextResponse.json({ error: "canvasId is required." }, { status: 400 });
    const mode = body.mode ?? "chat";

    // Access-checked load; context is built from the DB, not client input.
    const { canvas, scenes } = await getCanvasWithScenes(actor, body.canvasId);
    const context = buildCanvasContext(canvas, scenes);
    const system: BoltMessage = { role: "system", content: canvasBoltPreamble(context, "there") };

    if (mode === "suggest_pins") {
      const msgs: BoltMessage[] = [system, { role: "user", content: 'Propose up to 5 helpful note pins the homeowner should add to capture this project clearly (things to decide, measure, or flag). Respond with ONLY a JSON array like [{"label":"short label","note":"one-sentence note"}]. No prose.' }];
      const res = await callHermes(msgs);
      if ("error" in res) return NextResponse.json({ error: res.error }, { status: 502 });
      const suggestions = extractJson<Array<{ label: string; note: string }>>(res.content) ?? [];
      return NextResponse.json({ suggestions: suggestions.filter((s) => s && s.note).slice(0, 5) });
    }

    if (mode === "read_back") {
      const msgs: BoltMessage[] = [system, { role: "user", content: 'Read this project back in plain language. Respond with ONLY JSON: {"headline":"short headline","narrative":"one warm paragraph summarizing what they want built","chips":["3 scenes","4 pins","2 voice notes"]}. Base chips on the actual canvas.' }];
      const res = await callHermes(msgs);
      if ("error" in res) return NextResponse.json({ error: res.error }, { status: 502 });
      const readback = extractJson<{ headline: string; narrative: string; chips: string[] }>(res.content);
      if (!readback) return NextResponse.json({ readback: { headline: "Here's what I'm seeing", narrative: res.content, chips: defaultChips(context) } });
      return NextResponse.json({ readback: { ...readback, chips: Array.isArray(readback.chips) && readback.chips.length ? readback.chips : defaultChips(context) } });
    }

    // chat
    const history = (body.history ?? []).slice(-10).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }) as BoltMessage);
    const msgs: BoltMessage[] = [system, ...history];
    if (body.message) msgs.push({ role: "user", content: body.message.slice(0, 2000) });
    const res = await callHermes(msgs);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 502 });
    return NextResponse.json({ reply: res.content });
  } catch (err) {
    return canvasErrorResponse(err);
  }
}

function defaultChips(context: { counts: { scenes: number; pins: number; voiceNotes: number } }): string[] {
  const c = context.counts;
  const chips = [`${c.scenes} scene${c.scenes === 1 ? "" : "s"}`, `${c.pins} pin${c.pins === 1 ? "" : "s"}`];
  if (c.voiceNotes) chips.push(`${c.voiceNotes} voice note${c.voiceNotes === 1 ? "" : "s"}`);
  return chips;
}
